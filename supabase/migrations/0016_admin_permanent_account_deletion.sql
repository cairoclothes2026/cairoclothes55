-- Existing archived stores stay archived once their files start being removed.
alter table public.stores
  add column account_purge_started_at timestamptz,
  add constraint stores_account_purge_requires_archive check (
    account_purge_started_at is null or (admin_archived_at is not null and status = 'paused')
  );

-- Serialize new applications with the purge's profile lock, including requests
-- already carrying an access token when the owner's sessions are revoked.
create function public.prevent_purging_owner_store_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.profiles where id = new.owner_id for key share;
  if exists (
    select 1 from public.stores
    where owner_id = new.owner_id and account_purge_started_at is not null
  ) then
    raise exception 'account_purge_in_progress' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_purging_owner_store_submission() from public, anon, authenticated;
create trigger stores_block_submission_during_account_purge
before insert on public.stores
for each row execute function public.prevent_purging_owner_store_submission();

-- File bytes must be removed through the Storage API. Permit only active
-- platform admins and only the folder of an archived store being purged.
create function public.can_remove_purging_store_image(p_bucket text, p_name text)
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
  );
exception when insufficient_privilege then
  return false;
end;
$$;

revoke all on function public.can_remove_purging_store_image(text, text) from public, anon;
grant execute on function public.can_remove_purging_store_image(text, text) to authenticated;

create policy admin_purge_store_images_select on storage.objects
for select to authenticated using (public.can_remove_purging_store_image(bucket_id, name));
create policy admin_purge_store_images_delete on storage.objects
for delete to authenticated using (public.can_remove_purging_store_image(bucket_id, name));

create function public.permanently_delete_archived_account(p_kind text, p_id uuid)
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
    if exists (select 1 from public.stores where owner_id = v_owner_id and id is distinct from v_store_id)
      or exists (select 1 from public.store_members where profile_id = v_owner_id and store_id is distinct from v_store_id) then
      raise exception 'account_linked_to_other_stores' using errcode = '55000';
    end if;
    if exists (
      select 1 from storage.objects o
      where o.owner_id = v_owner_id::text
        and (v_store_id is null or o.bucket_id <> 'product-images' or o.name not like v_store_id::text || '/%')
    ) then
      raise exception 'account_has_external_storage' using errcode = '55000';
    end if;
  end if;

  if v_store_id is not null then
    select jsonb_agg(f.name order by f.name) into v_files
    from (
      select o.name from storage.objects o
      where o.bucket_id = 'product-images' and o.name like v_store_id::text || '/%'
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
    delete from auth.users where id = v_owner_id;
  end if;

  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.permanently_delete_archived_account(text, uuid) from public, anon;
grant execute on function public.permanently_delete_archived_account(text, uuid) to authenticated;
