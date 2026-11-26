-- Allow trusted platform admins to hide all stores from public discovery
-- without deleting their requests, products, memberships, or audit history.

alter table public.stores
  add column if not exists admin_archived_at timestamptz,
  add column if not exists admin_archive_previous_status public.store_status;

alter table public.platform_audit_log
  drop constraint if exists platform_audit_log_action_check;

alter table public.platform_audit_log
  add constraint platform_audit_log_action_check
  check (action in ('store_approved','store_rejected','store_archived','store_restored'));

create or replace function public.archive_all_stores_from_site()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_store record;
  v_count integer := 0;
begin
  if v_actor_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_platform_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  for v_store in
    select s.id, s.status
      from public.stores s
      where s.admin_archived_at is null
      order by s.created_at
      for update
  loop
    update public.stores
      set admin_archive_previous_status = v_store.status,
          admin_archived_at = now(),
          status = 'paused'::public.store_status
      where id = v_store.id;

    insert into public.platform_audit_log(actor_id, action, store_id, from_status, to_status)
    values (v_actor_id, 'store_archived', v_store.id, v_store.status, 'paused'::public.store_status);

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('archived_count', v_count);
end;
$$;

create or replace function public.restore_archived_store(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current_status public.store_status;
  v_previous_status public.store_status;
  v_next_status public.store_status;
begin
  if v_actor_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.is_platform_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  select s.status, s.admin_archive_previous_status
    into v_current_status, v_previous_status
    from public.stores s
    where s.id = p_store_id and s.admin_archived_at is not null
    for update;

  if not found then
    raise exception 'store_not_archived' using errcode = 'P0002';
  end if;

  v_next_status := coalesce(v_previous_status, 'pending'::public.store_status);

  update public.stores
    set status = v_next_status,
        admin_archived_at = null,
        admin_archive_previous_status = null
    where id = p_store_id;

  insert into public.platform_audit_log(actor_id, action, store_id, from_status, to_status)
  values (v_actor_id, 'store_restored', p_store_id, v_current_status, v_next_status);

  return jsonb_build_object('store_id', p_store_id, 'status', v_next_status);
end;
$$;

revoke all on function public.archive_all_stores_from_site() from public, anon;
revoke all on function public.restore_archived_store(uuid) from public, anon;
grant execute on function public.archive_all_stores_from_site() to authenticated;
grant execute on function public.restore_archived_store(uuid) to authenticated;
