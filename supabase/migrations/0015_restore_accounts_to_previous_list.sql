-- Restore a deleted store to the workflow it belonged to before archiving.
-- approved_at is the durable approval signal when older rows lack the
-- admin_archive_previous_status value.
create or replace function public.restore_archived_store(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := public.require_active_platform_admin();
  v_current_status public.store_status;
  v_previous_status public.store_status;
  v_approved_at timestamptz;
  v_next_status public.store_status;
begin
  select s.status, s.admin_archive_previous_status, s.approved_at
    into v_current_status, v_previous_status, v_approved_at
    from public.stores s
    where s.id = p_store_id and s.admin_archived_at is not null
    for update;

  if not found then
    raise exception 'store_not_archived' using errcode = 'P0002';
  end if;

  v_next_status := coalesce(
    v_previous_status,
    case when v_approved_at is not null then 'active'::public.store_status
         else 'pending'::public.store_status end
  );

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

revoke all on function public.restore_archived_store(uuid) from public, anon;
grant execute on function public.restore_archived_store(uuid) to authenticated;
