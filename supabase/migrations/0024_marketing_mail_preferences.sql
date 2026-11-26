create table public.marketing_mail_preferences (
  email_digest bytea primary key,
  link_token uuid not null unique default gen_random_uuid(),
  stopped_at timestamptz
);
alter table public.marketing_mail_preferences enable row level security;
revoke all on public.marketing_mail_preferences from public, anon, authenticated, service_role;

-- Only call from the sender for an independently opted-in recipient. NULL means do not send.
create function public.marketing_recipient_token(recipient text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare k bytea; result uuid;
begin
  if recipient is null or trim(recipient) = '' then return null; end if;
  k := sha256(convert_to(lower(trim(recipient)), 'UTF8'));
  insert into public.marketing_mail_preferences(email_digest) values(k) on conflict do nothing;
  select link_token into result from public.marketing_mail_preferences where email_digest=k and stopped_at is null;
  return result;
end $$;

create function public.stop_marketing_by_token(token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.marketing_mail_preferences set stopped_at=coalesce(stopped_at, now()) where link_token=token;
  return found;
end $$;

create function public.my_marketing_preference(stop_mail boolean default false) returns boolean
language plpgsql security definer set search_path = '' as $$
declare k bytea;
begin
  select sha256(convert_to(lower(trim(email)), 'UTF8')) into k from auth.users
    where id=auth.uid() and email_confirmed_at is not null and email is not null and deleted_at is null;
  if k is null then raise exception 'verified_email_required'; end if;
  if stop_mail then
    insert into public.marketing_mail_preferences(email_digest,stopped_at) values(k, now())
    on conflict(email_digest) do update set stopped_at=coalesce(marketing_mail_preferences.stopped_at, excluded.stopped_at);
  end if;
  return exists (select 1 from public.marketing_mail_preferences where email_digest=k and stopped_at is not null);
end $$;

revoke all on function public.marketing_recipient_token(text), public.stop_marketing_by_token(uuid), public.my_marketing_preference(boolean) from public, anon, authenticated, service_role;
grant execute on function public.marketing_recipient_token(text) to service_role;
grant execute on function public.stop_marketing_by_token(uuid) to anon, authenticated;
grant execute on function public.my_marketing_preference(boolean) to authenticated;
