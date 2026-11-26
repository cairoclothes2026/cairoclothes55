-- Platform staff roles remain controlled from the trusted Supabase SQL editor.
-- Ordinary users cannot update profiles.role or call the review function.

create table if not exists public.platform_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('store_approved','store_rejected')),
  store_id uuid not null references public.stores(id) on delete restrict,
  from_status public.store_status not null,
  to_status public.store_status not null,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_log_store_created_idx
  on public.platform_audit_log(store_id, created_at desc);

alter table public.platform_audit_log enable row level security;
revoke all on public.platform_audit_log from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'::public.app_role
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

drop policy if exists stores_admin_read on public.stores;
create policy stores_admin_read on public.stores
  for select to authenticated
  using (public.is_platform_admin());

create or replace function public.review_store_application(
  p_store_id uuid,
  p_decision text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_owner_id uuid;
  v_current_status public.store_status;
  v_next_status public.store_status;
begin
  if v_actor_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_platform_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approve','reject') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;

  select s.owner_id, s.status
    into v_owner_id, v_current_status
    from public.stores s
    where s.id = p_store_id
    for update;

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
  if v_owner_id = v_actor_id then
    raise exception 'self_review_forbidden' using errcode = '42501';
  end if;
  if v_current_status <> 'pending'::public.store_status then
    raise exception 'application_not_pending' using errcode = '22023';
  end if;

  v_next_status := case p_decision
    when 'approve' then 'active'::public.store_status
    else 'rejected'::public.store_status
  end;

  update public.stores
    set status = v_next_status,
        approved_at = case when p_decision = 'approve' then now() else null end
    where id = p_store_id;

  insert into public.platform_audit_log(actor_id, action, store_id, from_status, to_status)
  values (
    v_actor_id,
    case when p_decision = 'approve' then 'store_approved' else 'store_rejected' end,
    p_store_id,
    v_current_status,
    v_next_status
  );

  return jsonb_build_object('store_id', p_store_id, 'status', v_next_status);
end;
$$;

revoke all on function public.review_store_application(uuid,text) from public, anon;
grant execute on function public.review_store_application(uuid,text) to authenticated;
