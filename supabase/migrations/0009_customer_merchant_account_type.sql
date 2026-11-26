-- Every public account is either a shopper or a merchant. Platform admins
-- remain separately identified by profiles.role = 'admin'.
alter table public.profiles
  add column if not exists account_type text;

-- Existing accounts that already manage a store become merchant accounts.
update public.profiles p
set account_type = 'merchant'
where exists (
  select 1 from public.store_members m
  where m.profile_id = p.id
);

update public.profiles
set account_type = 'customer'
where account_type is null;

alter table public.profiles
  alter column account_type set default 'customer',
  alter column account_type set not null;

do $tag$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_account_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_type_check
      check (account_type in ('customer', 'merchant'));
  end if;
end;
$tag$;

-- Set the initial account type from the registration choice. Users cannot
-- edit this protected column through the public profiles grants.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles(id, full_name, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case when new.raw_user_meta_data ->> 'account_type' = 'merchant' then 'merchant' else 'customer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- A customer cannot gain a store membership. The account must be registered
-- as a merchant before it can own or manage a store.
create or replace function public.require_merchant_account_for_store_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.profile_id and p.account_type = 'merchant'
  ) then
    raise exception using
      errcode = '42501',
      message = 'merchant_account_required';
  end if;
  return new;
end;
$function$;

drop trigger if exists store_members_require_merchant_account on public.store_members;
create trigger store_members_require_merchant_account
before insert or update on public.store_members
for each row execute function public.require_merchant_account_for_store_membership();

-- Store applications are only accepted from a merchant-type account.
drop policy if exists stores_submit_pending on public.stores;
create policy stores_submit_pending on public.stores
  for insert to authenticated
  with check (
    status = 'pending'
    and owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.account_type = 'merchant'
    )
  );
