-- Install with the cutoff unset. Set effective_at to a verified release time
-- after deploying the matching site. Accounts created before it stay exempt.
begin;

create table public.legal_registration_config (
  singleton boolean primary key check (singleton),
  effective_at timestamptz,
  version text not null
);

create table public.legal_document_versions (
  document_id text not null check (document_id in ('terms', 'privacy', 'merchant-agreement', 'product-policy')),
  version text not null,
  document_hash text not null check (document_hash ~ '^[0-9a-f]{64}$'),
  primary key (document_id, version)
);

-- Do not retain names or email addresses in the legal record. No FK to the
-- account: its limited acceptance evidence survives approved account removal.
create table public.legal_acceptances (
  id bigint generated always as identity primary key,
  account_id uuid not null,
  account_type text not null check (account_type in ('customer', 'merchant')),
  document_id text not null,
  version text not null,
  document_hash text not null check (document_hash ~ '^[0-9a-f]{64}$'),
  event_kind text not null check (
    (document_id = 'privacy' and event_kind = 'acknowledged')
    or (document_id <> 'privacy' and event_kind = 'accepted')
  ),
  locale text not null check (locale in ('ar', 'en')),
  provider text not null,
  accepted_at timestamptz not null,
  foreign key (document_id, version) references public.legal_document_versions(document_id, version),
  unique (account_id, document_id, version)
);

create index legal_acceptances_type_id_idx on public.legal_acceptances (account_type, id desc);

alter table public.legal_registration_config enable row level security;
alter table public.legal_document_versions enable row level security;
alter table public.legal_acceptances enable row level security;
revoke all on public.legal_registration_config, public.legal_document_versions, public.legal_acceptances
  from public, anon, authenticated, service_role;
revoke all on sequence public.legal_acceptances_id_seq from public, anon, authenticated, service_role;

insert into public.legal_registration_config (singleton, version) values (true, '2026-11-17-v1');

-- SHA-256 of UTF-8 JSON.stringify({id, version, title, intro, sections}) for
-- the bilingual documents in lib/legal.ts, with keys in the stated order.
insert into public.legal_document_versions (document_id, version, document_hash) values
  ('terms', '2026-11-17-v1', '1fb81965b2e64e879603fac88cf6310bff8e57beffc02fa287abdc86ed57db84'),
  ('privacy', '2026-11-17-v1', 'f2d4d51074c284b8f01ed166d65e155fcb76fa258e3a3193cac8486c7862f9e7'),
  ('merchant-agreement', '2026-11-17-v1', '2c46dcc15ac305fc9f3fd5f6b77318d2400b06498757c45584b255b6f2186ab3'),
  ('product-policy', '2026-11-17-v1', '87d04fbc0a15f73232de25b50947da9387599623411f7e93f4639be6a634973b');

create function public.reject_legal_record_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'legal_record_is_append_only' using errcode = '42501';
end;
$$;

revoke all on function public.reject_legal_record_change() from public, anon, authenticated, service_role;
create trigger legal_acceptances_append_only
  before update or delete or truncate on public.legal_acceptances
  for each statement execute function public.reject_legal_record_change();
create trigger legal_document_versions_append_only
  before update or delete or truncate on public.legal_document_versions
  for each statement execute function public.reject_legal_record_change();

-- All required documents are recorded atomically. A terms event proves that
-- this account type completed the entire step, including its privacy notice.
create function public.legal_account_access_allowed(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = p_account_id
      and (
        p.role = 'admin'::public.app_role
        or not exists (
          select 1 from public.legal_registration_config c
          where c.singleton and u.created_at >= c.effective_at
        )
        or exists (
          select 1 from public.legal_acceptances a
          where a.account_id = p.id and a.document_id = 'terms' and a.account_type = p.account_type
        )
      )
  );
$$;
revoke all on function public.legal_account_access_allowed(uuid) from public, anon, authenticated, service_role;

create function public.legal_session_has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.legal_account_access_allowed(auth.uid());
$$;
revoke all on function public.legal_session_has_access() from public, anon, authenticated, service_role;
grant execute on function public.legal_session_has_access() to authenticated;

-- Verify the caller against a current Auth session as well as the profile
-- removal and revocation checks already used by the site.
create function public.require_legal_session()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := auth.uid();
begin
  if v_account_id is null or not public.shopper_profile_access_allowed() or not exists (
    select 1
    from auth.sessions s
    join auth.users u on u.id = s.user_id
    where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.user_id = v_account_id
      and (s.not_after is null or s.not_after > now())
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  ) then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return v_account_id;
end;
$$;
revoke all on function public.require_legal_session() from public, anon, authenticated, service_role;

create function public.legal_registration_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'required', registration.required,
    'account_type', p.account_type,
    'can_choose_type', registration.required and not p.account_type_locked,
    'is_new', p.role <> 'admin'::public.app_role and coalesce(u.created_at >= c.effective_at, false)
  )
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.legal_registration_config c on c.singleton
  cross join lateral (select not public.legal_account_access_allowed(p.id) as required) registration
  where p.id = public.require_legal_session();
$$;
revoke all on function public.legal_registration_status() from public, anon, authenticated, service_role;
grant execute on function public.legal_registration_status() to authenticated;

create function public.record_legal_acceptance(
  p_account_type text,
  p_locale text,
  p_version text,
  p_accepted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := public.require_legal_session();
  v_account_type text;
  v_role public.app_role;
  v_locked boolean;
  v_created_at timestamptz;
  v_provider text;
  v_effective_at timestamptz;
  v_version text;
  v_document_count integer;
begin
  if p_accepted is distinct from true then
    raise exception 'legal_acceptance_required' using errcode = '22023';
  end if;
  if p_account_type is null or p_account_type not in ('customer', 'merchant')
    or p_locale is null or p_locale not in ('ar', 'en') then
    raise exception 'invalid_legal_registration' using errcode = '22023';
  end if;

  -- Serialize repeated submissions and account type changes for the same user.
  select p.account_type, p.role, p.account_type_locked
    into v_account_type, v_role, v_locked
  from public.profiles p
  where p.id = v_account_id and p.shopper_deleted_at is null
  for update;
  if not found then
    raise exception 'profile_unavailable' using errcode = 'P0002';
  end if;

  select u.created_at, coalesce(nullif(u.raw_app_meta_data ->> 'provider', ''), 'email')
    into v_created_at, v_provider
  from auth.users u
  where u.id = v_account_id;
  select c.effective_at, c.version into v_effective_at, v_version
  from public.legal_registration_config c where c.singleton;

  if v_role = 'admin'::public.app_role or v_effective_at is null or v_created_at < v_effective_at then
    return jsonb_build_object('required', false, 'account_type', v_account_type,
      'can_choose_type', false, 'is_new', false);
  end if;

  if v_locked and p_account_type <> v_account_type then
    raise exception 'account_type_conflict' using errcode = '42501';
  end if;
  if public.legal_account_access_allowed(v_account_id) then
    return jsonb_build_object('required', false, 'account_type', v_account_type,
      'can_choose_type', false, 'is_new', true);
  end if;
  if p_version is distinct from v_version then
    raise exception 'legal_version_mismatch' using errcode = '22023';
  end if;

  if not v_locked then
    if v_provider in ('email', 'phone') or not exists (
      select 1 from auth.identities i where i.user_id = v_account_id and i.provider = v_provider
    ) then
      raise exception 'oauth_identity_required' using errcode = '42501';
    end if;
    update public.profiles
    set account_type = p_account_type, account_type_locked = true
    where id = v_account_id;
  end if;

  insert into public.legal_acceptances (
    account_id, account_type, document_id, version, document_hash, event_kind, locale, provider, accepted_at
  )
  select v_account_id, p_account_type, d.document_id, d.version, d.document_hash,
    case when d.document_id = 'privacy' then 'acknowledged' else 'accepted' end,
    p_locale, v_provider, statement_timestamp()
  from public.legal_document_versions d
  where d.version = v_version
    and (p_account_type = 'merchant' or d.document_id in ('terms', 'privacy'));

  get diagnostics v_document_count = row_count;
  if v_document_count <> (case when p_account_type = 'merchant' then 4 else 2 end) then
    raise exception 'incomplete_legal_document_version' using errcode = '55000';
  end if;

  return jsonb_build_object('required', false, 'account_type', p_account_type,
    'can_choose_type', false, 'is_new', true);
end;
$$;
revoke all on function public.record_legal_acceptance(text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.record_legal_acceptance(text, text, text, boolean) to authenticated;

-- Administrator read only. The account details disappear from the admin
-- result when the active account is deleted. No duplicate identity data is
-- retained in the audit table.
create function public.list_legal_acceptances(
  p_account_type text,
  p_before_id bigint default null,
  p_document_id text default null
)
returns table (
  id bigint,
  account_id uuid,
  account_type text,
  document_id text,
  version text,
  document_hash text,
  event_kind text,
  locale text,
  provider text,
  accepted_at timestamptz,
  full_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_active_platform_admin();
  if (p_account_type is null and p_document_id is distinct from 'privacy')
    or (p_account_type is not null and p_account_type not in ('customer', 'merchant'))
    or (p_document_id is not null and p_document_id not in ('terms', 'privacy', 'merchant-agreement', 'product-policy'))
    or (p_before_id is not null and p_before_id < 1) then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  return query
    select a.id, a.account_id, a.account_type, a.document_id, a.version, a.document_hash,
      a.event_kind, a.locale, a.provider, a.accepted_at, p.full_name, u.email::text
    from public.legal_acceptances a
    left join auth.users u on u.id = a.account_id and u.deleted_at is null
    left join public.profiles p on p.id = u.id
    where (p_account_type is null or a.account_type = p_account_type)
      and (p_document_id is null or a.document_id = p_document_id)
      and (p_before_id is null or a.id < p_before_id)
    order by a.id desc
    limit 50;
end;
$$;
revoke all on function public.list_legal_acceptances(text, bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function public.list_legal_acceptances(text, bigint, text) to authenticated;

-- Limit authenticated features. Catalog and image reads still use their
-- existing public policies. Store member policies depend on membership reads.
create policy profiles_require_legal_registration on public.profiles
  as restrictive for all to authenticated
  using ((select public.legal_session_has_access()))
  with check ((select public.legal_session_has_access()));

create policy favorites_require_legal_registration on public.favorites
  as restrictive for all to authenticated
  using ((select public.legal_session_has_access()))
  with check ((select public.legal_session_has_access()));

create policy store_members_require_legal_registration on public.store_members
  as restrictive for select to authenticated
  using ((select public.legal_session_has_access()));

create policy product_views_require_legal_registration on public.product_views
  as restrictive for insert to authenticated
  with check (profile_id is null or (select public.legal_session_has_access()));

-- The store application RPC bypasses RLS. Gate new ownership in a trigger
-- so other existing paths are subject to the same registration requirement.
create function public.require_store_owner_legal_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.owner_id is not distinct from old.owner_id then
    return new;
  end if;
  if new.owner_id is not null and not public.legal_account_access_allowed(new.owner_id) then
    raise exception 'legal_registration_required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.require_store_owner_legal_registration() from public, anon, authenticated, service_role;
create trigger stores_require_owner_legal_registration
  before insert or update of owner_id on public.stores
  for each row execute function public.require_store_owner_legal_registration();

-- Preserve the legacy OAuth path for earlier accounts. New accounts can only
-- resolve their final account type as part of the legal acceptance transaction.
create or replace function public.complete_oauth_account_registration(selected_account_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_type text;
  v_locked boolean;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if selected_account_type is not null and selected_account_type not in ('customer', 'merchant') then
    raise exception 'invalid_account_type' using errcode = '22023';
  end if;

  select p.role, p.account_type, p.account_type_locked into v_role, v_type, v_locked
  from public.profiles p
  where p.id = v_user_id and p.shopper_deleted_at is null
  for update;

  if not found or not public.shopper_profile_access_allowed() then
    raise exception 'profile_unavailable' using errcode = 'P0002';
  end if;
  if not public.legal_account_access_allowed(v_user_id) then
    raise exception 'legal_registration_required' using errcode = '42501';
  end if;
  if v_role = 'admin' and selected_account_type is not null then
    raise exception 'account_type_conflict' using errcode = '42501';
  end if;
  if v_locked or v_role = 'admin' then
    if selected_account_type is not null and selected_account_type <> v_type then
      raise exception 'account_type_conflict' using errcode = '42501';
    end if;
    return true;
  end if;

  if not exists (
    select 1 from auth.identities i
    where i.user_id = v_user_id and i.provider not in ('email', 'phone')
  ) then
    raise exception 'oauth_identity_required' using errcode = '42501';
  end if;

  update public.profiles
  set account_type = coalesce(selected_account_type, v_type), account_type_locked = true
  where id = v_user_id;
  return true;
end;
$$;

commit;
