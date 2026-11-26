-- Reports are evidence captured at submission. Identity and listing fields are
-- snapshots rather than foreign keys so account and catalog deletion are independent.
create table public.listing_reports (
  id uuid primary key,
  created_at timestamptz not null default now(),
  reporter_id uuid not null,
  kind text not null check (kind in ('store','product')),
  target_id uuid not null,
  message text not null check (char_length(trim(message)) between 1 and 4000),
  evidence jsonb not null
);
create index listing_reports_inbox_idx on public.listing_reports(created_at desc, id desc);
create index listing_reports_sender_idx on public.listing_reports(reporter_id, created_at desc);

create table public.listing_ratings (
  kind text not null check (kind in ('store','product')),
  target_id uuid not null,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  primary key(kind,target_id,voter_id)
);
create index listing_ratings_voter_idx on public.listing_ratings(voter_id);
alter table public.listing_reports enable row level security;
alter table public.listing_ratings enable row level security;
revoke all on public.listing_reports, public.listing_ratings from public, anon, authenticated, service_role;

create function public.prevent_report_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'report_history_is_immutable';
end $$;
create trigger protect_listing_report before update or delete on public.listing_reports
for each row execute function public.prevent_report_changes();
revoke all on function public.prevent_report_changes() from public, anon, authenticated, service_role;

-- Internal helpers: no client may call these directly.
create function public.feedback_store(p_kind text,p_target uuid) returns uuid
language sql stable set search_path = '' as $$
  select s.id from public.stores s where s.status='active' and s.admin_archived_at is null
    and ((p_kind='store' and s.id=p_target) or
         (p_kind='product' and exists(select 1 from public.products p where p.id=p_target and p.store_id=s.id and p.active)))
$$;
create function public.feedback_identity(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id',p.id,'name',p.full_name,'email',u.email,'phone',nullif(u.phone,''),
    'account_type',p.account_type,'role',p.role,'created_at',u.created_at)
  from public.profiles p join auth.users u on u.id=p.id where p.id=p_id
$$;
revoke all on function public.feedback_store(text,uuid), public.feedback_identity(uuid) from public, anon, authenticated, service_role;

create function public.feedback_account_active() returns boolean
language sql stable set search_path = '' as $$
  select public.legal_session_has_access() and exists (
    select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=auth.uid() and p.shopper_deleted_at is null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  )
$$;
revoke all on function public.feedback_account_active() from public, anon, authenticated, service_role;

create function public.submit_listing_report(p_kind text,p_target uuid,p_message text,p_request uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  sender uuid := auth.uid();
  shop uuid;
  snapshot jsonb;
begin
  if sender is null or not coalesce(public.feedback_account_active(),false) then raise exception 'sign_in_required'; end if;
  if p_request is null or coalesce(length(trim(p_message)),0) not between 1 and 4000 then raise exception 'invalid_report'; end if;
  perform pg_advisory_xact_lock(hashtextextended(sender::text,301));
  if exists(select 1 from public.listing_reports where id=p_request and reporter_id=sender
      and kind=p_kind and target_id=p_target and message=trim(p_message)) then return p_request; end if;
  if (select count(*) from public.listing_reports where reporter_id=sender and created_at>now()-interval '1 hour') >= 12 then raise exception 'report_rate_limit'; end if;
  shop := public.feedback_store(p_kind,p_target);
  if shop is null then raise exception 'listing_unavailable'; end if;
  select jsonb_build_object('sender',public.feedback_identity(sender),'owner',public.feedback_identity(s.owner_id),
    'store',jsonb_build_object('id',s.id,'slug',s.slug,'name_ar',s.name_ar,'name_en',s.name_en,'contact_name',s.contact_name,
       'area',s.area_id,'address_ar',s.address_ar,'address_en',s.address_en,'phone',s.phone,'whatsapp',s.whatsapp,
       'description_ar',s.description_ar,'description_en',s.description_en,'location_url',s.location_url,
       'latitude',s.latitude,'longitude',s.longitude,'created_at',s.created_at,'updated_at',s.updated_at),
    'product',case when p.id is not null then to_jsonb(p) end)
  into strict snapshot from public.stores s left join public.products p on p_kind='product' and p.id=p_target and p.store_id=s.id
  where s.id=shop;
  if snapshot->'sender' = 'null'::jsonb or (p_kind='product' and snapshot->'product'='null'::jsonb) then raise exception 'listing_unavailable'; end if;
  insert into public.listing_reports(id,reporter_id,kind,target_id,message,evidence)
  values(p_request,sender,p_kind,p_target,trim(p_message),snapshot);
  return p_request;
end $$;

create function public.read_listing_rating(p_kind text,p_target uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('count',count(*),'average',round(avg(stars),1),'mine',max(stars) filter(where voter_id=auth.uid()))
  from public.listing_ratings where kind=p_kind and target_id=p_target and public.feedback_store(p_kind,p_target) is not null
$$;
create function public.rate_listing(p_kind text,p_target uuid,p_stars integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(public.feedback_account_active(),false) then raise exception 'sign_in_required'; end if;
  if p_stars is null or p_stars not between 1 and 5 or public.feedback_store(p_kind,p_target) is null then raise exception 'invalid_rating'; end if;
  insert into public.listing_ratings(kind,target_id,voter_id,stars) values(p_kind,p_target,auth.uid(),p_stars)
  on conflict(kind,target_id,voter_id) do update set stars=excluded.stars;
  return public.read_listing_rating(p_kind,p_target);
end $$;
create function public.list_complaints(p_page integer) returns setof public.listing_reports
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_active_platform_admin();
  if p_page is null or p_page < 0 then raise exception 'invalid_page'; end if;
  return query select * from public.listing_reports order by created_at desc,id desc limit 25 offset (25::bigint*p_page);
end $$;
revoke all on function public.submit_listing_report(text,uuid,text,uuid),public.rate_listing(text,uuid,integer),
  public.read_listing_rating(text,uuid),public.list_complaints(integer) from public,anon,authenticated,service_role;
grant execute on function public.read_listing_rating(text,uuid) to anon,authenticated;
grant execute on function public.submit_listing_report(text,uuid,text,uuid),public.rate_listing(text,uuid,integer),
  public.list_complaints(integer) to authenticated;
