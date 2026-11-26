-- Paginate and search store records with an explicit platform administrator gate.
create or replace function public.list_admin_store_applications(
  p_status text,
  p_query text,
  p_page integer
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_page_size constant integer := 25;
  v_result jsonb;
begin
  perform public.require_active_platform_admin();
  if p_status is null or p_status not in ('approved', 'pending', 'deleted', 'rejected')
    or p_page is null or p_page not between 1 and 100000
    or length(v_query) > 160 then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  with matches as materialized (
    select s.id, s.owner_id, u.email as owner_email, s.slug,
      s.name_ar, s.name_en, s.area_id, a.name_ar as area_name_ar, a.name_en as area_name_en,
      s.address_ar, s.address_en, s.contact_name, s.phone, s.status,
      s.admin_archived_at, s.admin_archive_previous_status, s.created_at, s.approved_at
    from public.stores s
    left join public.areas a on a.id = s.area_id
    left join auth.users u on u.id = s.owner_id
    where (
      case p_status
        when 'approved' then s.admin_archived_at is null and s.status in ('active', 'paused')
        when 'pending' then s.admin_archived_at is null and s.status = 'pending'
        when 'deleted' then s.admin_archived_at is not null
        when 'rejected' then s.admin_archived_at is null and s.status = 'rejected'
      end
    ) and (
      v_query = '' or strpos(lower(concat_ws(' ',
        s.id::text, s.owner_id::text, u.email, s.slug, s.name_ar, s.name_en,
        s.area_id, a.name_ar, a.name_en, s.address_ar, s.address_en,
        s.contact_name, s.phone, s.whatsapp, s.description_ar, s.description_en,
        s.created_at::date::text, s.approved_at::date::text, s.admin_archived_at::date::text
      )), v_query) > 0
    )
  ), page_rows as (
    select * from matches
    order by created_at desc, id desc
    limit v_page_size offset (p_page - 1) * v_page_size
  )
  select jsonb_build_object(
    'applications', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id desc) from page_rows r), '[]'::jsonb),
    'total', (select count(*) from matches),
    'page', p_page,
    'pageSize', v_page_size
  ) into v_result;

  return v_result;
end;
$$;

-- A single-store archive uses the same status, audit and restore path as bulk archiving.
create or replace function public.archive_store_from_site(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := public.require_active_platform_admin();
  v_status public.store_status;
  v_archived_at timestamptz;
begin
  select s.status, s.admin_archived_at into v_status, v_archived_at
  from public.stores s
  where s.id = p_store_id
  for update;

  if not found then
    raise exception 'store_not_found' using errcode = 'P0002';
  end if;
  if v_archived_at is not null then
    return jsonb_build_object('store_id', p_store_id, 'status', v_status);
  end if;

  update public.stores
  set admin_archive_previous_status = v_status,
      admin_archived_at = now(),
      status = 'paused'
  where id = p_store_id;

  insert into public.platform_audit_log(actor_id, action, store_id, from_status, to_status)
  values (v_actor_id, 'store_archived', p_store_id, v_status, 'paused');

  return jsonb_build_object('store_id', p_store_id, 'status', 'paused');
end;
$$;

revoke all on function public.list_admin_store_applications(text,text,integer) from public, anon;
revoke all on function public.archive_store_from_site(uuid) from public, anon;
grant execute on function public.list_admin_store_applications(text,text,integer) to authenticated;
grant execute on function public.archive_store_from_site(uuid) to authenticated;

-- Keep the existing all-pending action independent of the current search page.
create or replace function public.approve_all_pending_stores()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := public.require_active_platform_admin();
  v_count integer;
begin
  with approved as (
    update public.stores
    set status = 'active', approved_at = now()
    where status = 'pending'
      and admin_archived_at is null
      and owner_id is distinct from v_actor_id
    returning id
  ), audited as (
    insert into public.platform_audit_log(actor_id, action, store_id, from_status, to_status)
    select v_actor_id, 'store_approved', id, 'pending', 'active' from approved
    returning id
  )
  select count(*) into v_count from audited;

  return jsonb_build_object('approved_count', v_count);
end;
$$;

revoke all on function public.approve_all_pending_stores() from public, anon;
grant execute on function public.approve_all_pending_stores() to authenticated;
