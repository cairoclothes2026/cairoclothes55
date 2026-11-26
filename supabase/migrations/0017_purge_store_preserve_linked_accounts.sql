-- Purge the selected account even when it has links to other store records.
-- Storage paths outside the selected store remain available to those stores.
create function public.store_image_used_elsewhere(p_store_id uuid, p_path text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    cross join lateral unnest(p.images) as image(url)
    where p.store_id <> p_store_id
      and right(split_part(image.url, '?', 1), length('/product-images/' || p_path)) = '/product-images/' || p_path
  );
$$;

revoke all on function public.store_image_used_elsewhere(uuid, text) from public, anon, authenticated;

create or replace function public.can_remove_purging_store_image(p_bucket text, p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_bucket <> 'product-images' or strpos(p_name, '/') = 0 then
    return false;
  end if;
  perform public.require_active_platform_admin();
  return exists (
    select 1 from public.stores s
    where s.id::text = split_part(p_name, '/', 1)
      and s.admin_archived_at is not null and s.account_purge_started_at is not null
      and not public.store_image_used_elsewhere(s.id, p_name)
  );
exception when insufficient_privilege then
  return false;
end;
$$;

create or replace function public.permanently_delete_archived_account(p_kind text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_active_platform_admin();
  v_store_id uuid;
  v_owner_id uuid;
  v_archived_at timestamptz;
  v_purge_started_at timestamptz;
  v_role public.app_role;
  v_account_type text;
  v_shopper_deleted_at timestamptz;
  v_files jsonb;
begin
  if p_id is null or p_kind is null or p_kind not in ('shopper', 'store') then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  if p_kind = 'store' then
    select id, owner_id, admin_archived_at, account_purge_started_at
    into v_store_id, v_owner_id, v_archived_at, v_purge_started_at
    from public.stores where id = p_id for update;
    if not found then
      raise exception 'record_not_found' using errcode = 'P0002';
    end if;
    if v_archived_at is null then
      raise exception 'record_not_archived' using errcode = '55000';
    end if;
  else
    v_owner_id := p_id;
  end if;

  if v_owner_id is not null then
    select p.role, p.account_type, p.shopper_deleted_at
    into v_role, v_account_type, v_shopper_deleted_at
    from public.profiles p join auth.users u on u.id = p.id
    where p.id = v_owner_id for update of p, u;
    if not found then
      raise exception 'record_not_found' using errcode = 'P0002';
    end if;
    if v_owner_id = v_actor or v_role <> 'customer'
      or (p_kind = 'shopper' and v_account_type <> 'customer')
      or (p_kind = 'store' and v_account_type <> 'merchant')
      or exists (select 1 from public.platform_audit_log where actor_id = v_owner_id)
      or exists (select 1 from public.shopper_account_audit where actor_id = v_owner_id) then
      raise exception 'protected_account' using errcode = '55000';
    end if;
    if p_kind = 'shopper' and v_shopper_deleted_at is null then
      raise exception 'record_not_archived' using errcode = '55000';
    end if;
  end if;

  if v_store_id is not null then
    select jsonb_agg(f.name order by f.name) into v_files
    from (
      select o.name from storage.objects o
      where o.bucket_id = 'product-images' and o.name like v_store_id::text || '/%'
        and not public.store_image_used_elsewhere(v_store_id, o.name)
      order by o.name limit 100
    ) f;

    if v_files is not null then
      if v_purge_started_at is null then
        update public.stores set account_purge_started_at = now(), status = 'paused' where id = v_store_id;
        if v_owner_id is not null then
          update auth.users set banned_until = greatest(banned_until, now() + interval '100 years') where id = v_owner_id;
          update public.profiles set shopper_sessions_revoked_at = clock_timestamp() where id = v_owner_id;
          delete from auth.sessions where user_id = v_owner_id;
        end if;
      end if;
      return jsonb_build_object('deleted', false, 'image_paths', v_files);
    end if;

    delete from public.platform_audit_log where store_id = v_store_id;
    delete from public.coupon_redemptions r using public.coupons c
    where r.coupon_id = c.id and c.store_id = v_store_id;
    delete from public.stores where id = v_store_id;
  end if;

  if v_owner_id is not null then
    delete from public.shopper_account_audit where shopper_id = v_owner_id;
    delete from public.coupon_redemptions where customer_profile_id = v_owner_id;
    delete from public.product_views where profile_id = v_owner_id;
    -- The owner FK nulls ownership of other stores and membership FKs remove
    -- this user's access. Neither deletes the other stores or their content.
    delete from auth.users where id = v_owner_id;
  end if;

  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.permanently_delete_archived_account(text, uuid) from public, anon;
grant execute on function public.permanently_delete_archived_account(text, uuid) to authenticated;
