-- Reversible shopper removal. Preserve the profile, Auth identity, favorites,
-- and other shopper records. Only the shopper's login sessions are revoked.
alter table public.profiles
  add column if not exists shopper_deleted_at timestamptz,
  add column if not exists shopper_delete_reason text,
  add column if not exists shopper_previous_banned_until timestamptz,
  add column if not exists shopper_managed_banned_until timestamptz,
  add column if not exists shopper_sessions_revoked_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_shopper_removal_check;
alter table public.profiles
  add constraint profiles_shopper_removal_check check (
    (
      shopper_deleted_at is null
      and shopper_delete_reason is null
      and shopper_previous_banned_until is null
      and shopper_managed_banned_until is null
    )
    or (
      shopper_deleted_at is not null
      and shopper_managed_banned_until is not null
      and shopper_sessions_revoked_at is not null
      and role = 'customer'::public.app_role
      and account_type = 'customer'
      and (shopper_delete_reason is null or length(shopper_delete_reason) <= 240)
    )
  );

create table if not exists public.shopper_account_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  shopper_id uuid not null,
  action text not null check (action in ('soft_delete', 'restore')),
  reason text check (length(reason) <= 240),
  created_at timestamptz not null default now()
);

alter table public.shopper_account_audit enable row level security;
revoke all on public.shopper_account_audit from public, anon, authenticated;
revoke all on sequence public.shopper_account_audit_id_seq from public, anon, authenticated;

-- Access tokens issued before removal are still signed JWTs. Check removal
-- immediately and require a new session after restoration.
create or replace function public.shopper_profile_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.shopper_deleted_at is null
      and (
        p.shopper_sessions_revoked_at is null
        or exists (
          select 1 from auth.sessions s
          where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
            and s.user_id = p.id
            and s.created_at >= p.shopper_sessions_revoked_at
        )
      )
  );
$$;

revoke all on function public.shopper_profile_access_allowed() from public, anon;
grant execute on function public.shopper_profile_access_allowed() to authenticated;

drop policy if exists profiles_shopper_removal_guard on public.profiles;
create policy profiles_shopper_removal_guard on public.profiles
  as restrictive for all to authenticated
  using ((select public.shopper_profile_access_allowed()))
  with check ((select public.shopper_profile_access_allowed()));

drop policy if exists favorites_shopper_removal_guard on public.favorites;
create policy favorites_shopper_removal_guard on public.favorites
  as restrictive for all to authenticated
  using ((select public.shopper_profile_access_allowed()))
  with check ((select public.shopper_profile_access_allowed()));

drop policy if exists product_views_shopper_removal_guard on public.product_views;
create policy product_views_shopper_removal_guard on public.product_views
  as restrictive for insert to authenticated
  with check (profile_id is null or (select public.shopper_profile_access_allowed()));

-- Keep this check inside both RPCs, since PostgREST can invoke them directly.
create or replace function public.require_active_platform_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not public.is_platform_admin() or not exists (
    select 1
    from auth.sessions s
    join auth.users u on u.id = s.user_id
    where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.user_id = v_actor_id
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  return v_actor_id;
end;
$$;

revoke all on function public.require_active_platform_admin() from public, anon, authenticated;

create or replace function public.list_shopper_accounts(
  p_status text default 'registered',
  p_query text default '',
  p_page integer default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page_size constant integer := 50;
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_result jsonb;
begin
  perform public.require_active_platform_admin();
  if p_status is null or p_status not in ('registered', 'deleted')
    or length(v_query) > 120 or p_page is null or p_page not between 1 and 10000 then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  with matching as (
    select p.id, p.full_name, u.email, u.phone, coalesce(u.created_at, p.created_at) as created_at,
      u.last_sign_in_at, p.shopper_deleted_at as deleted_at, p.shopper_delete_reason as delete_reason
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'customer'::public.app_role
      and p.account_type = 'customer'
      and u.deleted_at is null
      and ((p_status = 'deleted') = (p.shopper_deleted_at is not null))
      and (p_status = 'deleted' or (
        not exists (select 1 from public.store_members m where m.profile_id = p.id)
        and not exists (select 1 from public.stores s where s.owner_id = p.id)
      ))
      and (
        v_query = ''
        or strpos(lower(coalesce(p.full_name, '')), v_query) > 0
        or strpos(lower(coalesce(u.email, '')), v_query) > 0
        or strpos(coalesce(u.phone, ''), v_query) > 0
        or strpos(p.id::text, v_query) > 0
      )
  ), page_rows as (
    select * from matching
    order by deleted_at desc nulls last, created_at desc, id
    limit v_page_size offset ((p_page - 1) * v_page_size)
  )
  select jsonb_build_object(
    'shoppers', coalesce(
      (select jsonb_agg(to_jsonb(r) order by r.deleted_at desc nulls last, r.created_at desc, r.id) from page_rows r),
      '[]'::jsonb
    ),
    'total', (select count(*) from matching),
    'page', p_page,
    'pageSize', v_page_size
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.list_shopper_accounts(text,text,integer) from public, anon;
grant execute on function public.list_shopper_accounts(text,text,integer) to authenticated;

create or replace function public.change_shopper_account_status(
  p_shopper_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := public.require_active_platform_admin();
  v_deleted_at timestamptz;
  v_reason text;
  v_current_ban timestamptz;
  v_previous_ban timestamptz;
  v_managed_ban timestamptz;
  v_now timestamptz;
  v_requested_reason text := nullif(btrim(p_reason), '');
begin
  if p_shopper_id is null or p_action is null or p_action not in ('soft_delete', 'restore')
    or length(v_requested_reason) > 240 then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  select p.shopper_deleted_at, p.shopper_delete_reason, u.banned_until,
    p.shopper_previous_banned_until, p.shopper_managed_banned_until
    into v_deleted_at, v_reason, v_current_ban, v_previous_ban, v_managed_ban
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_shopper_id
    and p.id <> v_actor_id
    and p.role = 'customer'::public.app_role
    and p.account_type = 'customer'
    and u.deleted_at is null
  for update of p, u;

  if not found then
    raise exception 'shopper_not_found' using errcode = 'P0002';
  end if;

  if (p_action = 'soft_delete' and v_deleted_at is not null)
    or (p_action = 'restore' and v_deleted_at is null) then
    return jsonb_build_object('id', p_shopper_id, 'deleted_at', v_deleted_at, 'delete_reason', v_reason);
  end if;

  v_now := clock_timestamp();
  if p_action = 'soft_delete' then
    if exists (select 1 from public.store_members m where m.profile_id = p_shopper_id)
      or exists (select 1 from public.stores s where s.owner_id = p_shopper_id) then
      raise exception 'shopper_has_store' using errcode = '55000';
    end if;

    v_deleted_at := v_now;
    v_reason := v_requested_reason;
    v_managed_ban := greatest(v_current_ban, v_now + interval '100 years');
    update public.profiles
    set shopper_deleted_at = v_deleted_at,
        shopper_delete_reason = v_reason,
        shopper_previous_banned_until = v_current_ban,
        shopper_managed_banned_until = v_managed_ban,
        shopper_sessions_revoked_at = v_now
    where id = p_shopper_id;

    -- Apply the same ban field as Supabase Auth, without replacing a longer ban.
    update auth.users set banned_until = v_managed_ban where id = p_shopper_id;
    delete from auth.sessions where user_id = p_shopper_id;
  else
    delete from auth.sessions where user_id = p_shopper_id;
    -- If Auth changed the ban separately, leave that newer state alone.
    if v_current_ban is not distinct from v_managed_ban then
      update auth.users set banned_until = v_previous_ban where id = p_shopper_id;
    end if;
    update public.profiles
    set shopper_deleted_at = null,
        shopper_delete_reason = null,
        shopper_previous_banned_until = null,
        shopper_managed_banned_until = null,
        shopper_sessions_revoked_at = v_now
    where id = p_shopper_id;
    v_deleted_at := null;
    v_reason := null;
  end if;

  insert into public.shopper_account_audit (actor_id, shopper_id, action, reason)
  values (v_actor_id, p_shopper_id, p_action, v_reason);

  return jsonb_build_object('id', p_shopper_id, 'deleted_at', v_deleted_at, 'delete_reason', v_reason);
end;
$$;

revoke all on function public.change_shopper_account_status(uuid,text,text) from public, anon;
grant execute on function public.change_shopper_account_status(uuid,text,text) to authenticated;
