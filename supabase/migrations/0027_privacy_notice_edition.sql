insert into public.legal_document_versions (document_id, version, document_hash) values
  ('terms', '2026-11-23-v1', 'dacf24bfc3b8b3c3977e0a25c46a9d6804bf2aa2c69afd0eceef2d9620c1c437'),
  ('privacy', '2026-11-23-v1', '315f84b6f320bb16f3159bfc2c4aeb33479f14a760483e943e28806617e6fb10'),
  ('merchant-agreement', '2026-11-23-v1', '5dfe5290ea7f1fda22017e03aa1e4abf0cb88ecf00ffc1dc50db00fbcfe6ec55'),
  ('product-policy', '2026-11-23-v1', 'f4825e5d17d32d95a9e46004656ade704ffd5dd8122612cf18e12fe87a2c1749');

update public.legal_registration_config set version = '2026-11-23-v1'
where singleton and version = '2026-11-17-v1';

insert into public.consent_email_retention_versions (version) values ('2026-11-23-v1');
alter table public.legal_acceptances
  add column acceptance_full_name text,
  add column account_created_at timestamptz;

create or replace function public.capture_acceptance_email() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.acceptance_email := null;
  new.acceptance_full_name := null;
  new.account_created_at := null;
  if exists (select 1 from public.consent_email_retention_versions v where v.version = new.version) then
    select nullif(trim(u.email), ''), p.full_name, u.created_at
      into strict new.acceptance_email, new.acceptance_full_name, new.account_created_at
    from auth.users u join public.profiles p on p.id = u.id
    where u.id = new.account_id;
    if new.acceptance_email is null or new.account_created_at is null then
      raise exception 'account_identity_unavailable';
    end if;
  end if;
  return new;
end;
$$;

drop function public.list_legal_acceptances(text, bigint, text);

create or replace function public.list_legal_acceptances(
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
  email text,
  account_created_at timestamptz
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
      a.event_kind, a.locale, a.provider, a.accepted_at, case when a.acceptance_email is not null then a.acceptance_full_name else p.full_name end, coalesce(a.acceptance_email, u.email::text), a.account_created_at
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

revoke all on function public.list_legal_acceptances(text, bigint, text) from public, anon, authenticated, service_role;
grant execute on function public.list_legal_acceptances(text, bigint, text) to authenticated;
notify pgrst, 'reload schema';
