begin;

-- A job exists only if a user with a fresh session has explicitly confirmed.
-- It is removed by the profile FK when account deletion commits.
create table public.account_self_deletion_jobs (
  account_id uuid primary key references public.profiles(id) on delete cascade,
  store_ids uuid[] not null,
  started_at timestamptz not null default now()
);
alter table public.account_self_deletion_jobs enable row level security;
revoke all on public.account_self_deletion_jobs from public, anon, authenticated;
create index account_self_deletion_jobs_store_ids_idx on public.account_self_deletion_jobs using gin (store_ids);

create function public.self_deletion_status()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with eligible as (
    select p.id, p.account_type, s.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    join auth.sessions s on s.user_id = p.id and s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    where p.id = auth.uid() and p.role = 'customer' and p.shopper_deleted_at is null
      and (p.shopper_sessions_revoked_at is null or s.created_at >= p.shopper_sessions_revoked_at)
      and (s.not_after is null or s.not_after > now())
      and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
      and exists (
        select 1 from public.legal_acceptances a
        where a.account_id = p.id and a.account_type = p.account_type and a.document_id = 'terms'
      )
  )
  select jsonb_build_object(
    'eligible', exists (select 1 from eligible),
    'account_type', (select account_type from eligible),
    'pending', exists (
      select 1 from public.account_self_deletion_jobs j join eligible e on e.id = j.account_id
    ),
    'recent_authentication', exists (select 1 from eligible where created_at >= now() - interval '10 minutes')
  );
$$;

create function public.self_deletion_store_pending(p_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.account_self_deletion_jobs j where j.store_ids @> array[p_store_id]
  );
$$;

-- Hide a store and its catalog while an exclusive storefront is being removed.
create policy stores_self_deletion_pending_guest_guard on public.stores
  as restrictive for select to anon
  using (not public.self_deletion_store_pending(id));
create policy stores_self_deletion_pending_guard on public.stores
  as restrictive for select to authenticated
  using (
    not public.self_deletion_store_pending(id) or owner_id = (select auth.uid()) or (select public.is_platform_admin())
  );

create function public.self_deletion_image_unused(p_name text, p_store_ids uuid[])
returns boolean
language sql stable set search_path = ''
as $$
  select not exists (
    select 1
    from public.products p
    cross join lateral unnest(p.images) as image(url)
    where not (p.store_id = any(p_store_ids))
      and right(split_part(split_part(image.url, '?', 1), '#', 1), length('/product-images/' || p_name))
        = '/product-images/' || p_name
  );
$$;

-- Require a fresh verified session for cleanup. It is limited to the exact
-- account's pending storefronts and files not shared with another account.
create function public.self_deletion_can_remove_image(p_bucket text, p_name text, p_owner text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_bucket = 'product-images'
    and (p_owner is null or p_owner = auth.uid()::text)
    and exists (
      select 1
      from public.account_self_deletion_jobs j
      join public.profiles p on p.id = j.account_id
      join auth.sessions s on s.user_id = j.account_id and s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      join auth.users u on u.id = j.account_id
      cross join lateral unnest(j.store_ids) as store(id)
      where j.account_id = auth.uid()
        and s.created_at >= now() - interval '10 minutes'
        and p.role = 'customer' and p.shopper_deleted_at is null
        and (p.shopper_sessions_revoked_at is null or s.created_at >= p.shopper_sessions_revoked_at)
        and (s.not_after is null or s.not_after > now())
        and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
        and store.id::text = split_part(p_name, '/', 1)
        and strpos(p_name, '/') > 0
        and public.self_deletion_image_unused(p_name, j.store_ids)
    );
$$;

create policy self_deletion_product_images_select on storage.objects
  for select to authenticated using (public.self_deletion_can_remove_image(bucket_id, name, owner_id));
create policy self_deletion_product_images_delete on storage.objects
  for delete to authenticated using (public.self_deletion_can_remove_image(bucket_id, name, owner_id));

-- Lock the owning account/store before testing for a job so new applications,
-- memberships and uploads cannot join a cleanup halfway through.
create function public.guard_self_deletion_store_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.profiles p where p.id = new.owner_id for key share;
  if exists (select 1 from public.account_self_deletion_jobs j where j.account_id = new.owner_id)
    or (tg_op = 'UPDATE' and public.self_deletion_store_pending(new.id)) then
    raise exception 'self_deletion_in_progress' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger stores_guard_self_deletion_owner
  before insert or update of owner_id on public.stores
  for each row execute function public.guard_self_deletion_store_owner();

create function public.guard_self_deletion_membership()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.profiles p where p.id = new.profile_id for key share;
  perform 1 from public.stores s where s.id = new.store_id for key share;
  if exists (select 1 from public.account_self_deletion_jobs j where j.account_id = new.profile_id)
    or public.self_deletion_store_pending(new.store_id) then
    raise exception 'self_deletion_in_progress' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger store_members_guard_self_deletion
  before insert or update on public.store_members
  for each row execute function public.guard_self_deletion_membership();

create function public.self_deletion_image_write_allowed(p_bucket text, p_name text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_store_id uuid;
begin
  if p_bucket <> 'product-images' then return true; end if;
  if split_part(p_name, '/', 1) !~ '^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$' then
    return true;
  end if;
  v_store_id := split_part(p_name, '/', 1)::uuid;
  perform 1 from public.stores s where s.id = v_store_id for key share;
  if not found then return false; end if;
  return not public.self_deletion_store_pending(v_store_id);
end;
$$;

create policy product_images_self_deletion_insert_guard on storage.objects
  as restrictive for insert to authenticated with check (public.self_deletion_image_write_allowed(bucket_id, name));
create policy product_images_self_deletion_update_guard on storage.objects
  as restrictive for update to authenticated
  using (public.self_deletion_image_write_allowed(bucket_id, name))
  with check (public.self_deletion_image_write_allowed(bucket_id, name));

-- Product URLs are editable. Prevent another store from adding a reference to
-- an image folder after cleanup has been authorized for that folder.
create function public.guard_self_deletion_product_image()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_source uuid;
begin
  for v_source in
    select s.id from public.stores s
    where s.id = new.store_id or s.id in (
      select substring(image from '/product-images/([[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12})/')::uuid
      from unnest(new.images) as images(image)
    )
    order by s.id for key share
  loop
    if public.self_deletion_store_pending(v_source) then
      raise exception 'self_deletion_in_progress' using errcode = '55000';
    end if;
  end loop;
  return new;
end;
$$;

create trigger products_guard_self_deletion_image
  before insert or update of store_id, images on public.products
  for each row execute function public.guard_self_deletion_product_image();

-- One invocation either returns the next bounded Storage API batch or
-- atomically deletes the account and its exclusive storefronts.
create function public.self_delete_account(p_confirmed boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_account uuid := auth.uid();
  v_status jsonb;
  v_account_created_at timestamptz;
  v_store_ids uuid[];
  v_planned_ids uuid[];
  v_paths jsonb;
begin
  if p_confirmed is distinct from true then
    raise exception 'self_deletion_confirmation_required' using errcode = '22023';
  end if;
  v_status := public.self_deletion_status();
  if (v_status ->> 'eligible')::boolean is distinct from true then
    raise exception 'self_deletion_not_eligible' using errcode = '42501';
  end if;
  if (v_status ->> 'recent_authentication')::boolean is distinct from true then
    raise exception 'self_deletion_reauthentication_required' using errcode = '42501';
  end if;

  select u.created_at into v_account_created_at
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = v_account for update of p, u;
  if not found then raise exception 'self_deletion_not_eligible' using errcode = '42501'; end if;
  -- Recheck after locking in case access changed while this request waited.
  v_status := public.self_deletion_status();
  if (v_status ->> 'eligible')::boolean is distinct from true then
    raise exception 'self_deletion_not_eligible' using errcode = '42501';
  end if;
  if (v_status ->> 'recent_authentication')::boolean is distinct from true then
    raise exception 'self_deletion_reauthentication_required' using errcode = '42501';
  end if;

  select coalesce(array_agg(st.locked_id order by st.locked_id), '{}'::uuid[])
  into v_store_ids
  from (
    select s.id as locked_id from public.stores s where s.owner_id = v_account order by s.id for update
  ) as st;
  select j.store_ids into v_planned_ids from public.account_self_deletion_jobs j where j.account_id = v_account;
  if (v_planned_ids is not null and v_planned_ids <> v_store_ids)
    or exists (select 1 from public.stores s where s.id = any(v_store_ids) and s.created_at < v_account_created_at)
    or exists (select 1 from public.store_members m where m.store_id = any(v_store_ids) and m.profile_id <> v_account)
    or exists (select 1 from public.platform_audit_log a where a.actor_id = v_account)
    or exists (select 1 from public.shopper_account_audit a where a.actor_id = v_account)
    or exists (
      select 1 from public.coupon_redemptions r
      join public.coupons c on c.id = r.coupon_id
      where c.store_id = any(v_store_ids) and r.customer_profile_id is distinct from v_account
    ) then
    raise exception 'self_deletion_support_required' using errcode = '55000';
  end if;

  if exists (
    select 1 from storage.objects o
    where o.owner_id = v_account::text
      and (
        o.bucket_id <> 'product-images' or strpos(o.name, '/') = 0
        or not exists (
          select 1 from unnest(v_store_ids) as store(id) where store.id::text = split_part(o.name, '/', 1)
        )
      )
  ) or exists (
    select 1 from storage.objects o
    join unnest(v_store_ids) as store(id) on store.id::text = split_part(o.name, '/', 1)
    where o.bucket_id = 'product-images' and strpos(o.name, '/') > 0
      and ((o.owner_id is not null and o.owner_id <> v_account::text)
        or not public.self_deletion_image_unused(o.name, v_store_ids))
  ) then
    raise exception 'self_deletion_support_required' using errcode = '55000';
  end if;

  select jsonb_agg(b.name order by b.name) into v_paths
  from (
    select o.name from storage.objects o
    join unnest(v_store_ids) as store(id) on store.id::text = split_part(o.name, '/', 1)
    where o.bucket_id = 'product-images' and strpos(o.name, '/') > 0
    order by o.name limit 100
  ) as b;
  if v_paths is not null then
    insert into public.account_self_deletion_jobs(account_id, store_ids)
    values (v_account, v_store_ids) on conflict (account_id) do nothing;
    return jsonb_build_object('deleted', false, 'image_paths', v_paths);
  end if;

  delete from public.platform_audit_log where store_id = any(v_store_ids);
  delete from public.coupon_redemptions r using public.coupons c
    where r.coupon_id = c.id and c.store_id = any(v_store_ids);
  delete from public.stores where id = any(v_store_ids);
  delete from public.shopper_account_audit where shopper_id = v_account;
  delete from public.product_views where profile_id = v_account;
  -- Profile, sessions, identities, memberships and favorites cascade.
  -- Consent records intentionally have no FK and remain intact.
  delete from auth.users where id = v_account;
  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.self_deletion_status() from public, anon, authenticated;
revoke all on function public.self_delete_account(boolean) from public, anon, authenticated;
grant execute on function public.self_deletion_status(), public.self_delete_account(boolean) to authenticated;

revoke all on function public.self_deletion_store_pending(uuid) from public, anon, authenticated;
grant execute on function public.self_deletion_store_pending(uuid) to anon, authenticated;
revoke all on function public.self_deletion_can_remove_image(text, text, text), public.self_deletion_image_write_allowed(text, text) from public, anon, authenticated;
grant execute on function public.self_deletion_can_remove_image(text, text, text), public.self_deletion_image_write_allowed(text, text) to authenticated;
revoke all on function public.self_deletion_image_unused(text, uuid[]) from public, anon, authenticated;

revoke all on function public.guard_self_deletion_store_owner(), public.guard_self_deletion_membership(), public.guard_self_deletion_product_image() from public, anon, authenticated;

commit;
