-- Versions must be explicitly enabled after their retention notice is approved.
create table public.consent_email_retention_versions (
  version text primary key,
  privacy_document text not null default 'privacy' check (privacy_document = 'privacy'),
  foreign key (privacy_document, version) references public.legal_document_versions(document_id, version),
  check (version <> '2026-11-17-v1')
);
alter table public.consent_email_retention_versions enable row level security;
revoke all on public.consent_email_retention_versions from public, anon, authenticated, service_role;

alter table public.legal_acceptances add column acceptance_email text;

create function public.capture_acceptance_email() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.acceptance_email := null;
  if exists (select 1 from public.consent_email_retention_versions v where v.version = new.version) then
    select nullif(trim(u.email), '') into strict new.acceptance_email
    from auth.users u where u.id = new.account_id;
    if new.acceptance_email is null then
      raise exception 'account_email_unavailable';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_acceptance_email() from public, anon, authenticated, service_role;
create trigger capture_acceptance_email before insert on public.legal_acceptances
  for each row execute function public.capture_acceptance_email();
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
      a.event_kind, a.locale, a.provider, a.accepted_at, p.full_name, coalesce(a.acceptance_email, u.email::text)
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
