-- Allow a newly created OAuth account to finish the account type choice made in the registration UI.
-- Existing accounts cannot be converted through this function.
create or replace function public.complete_oauth_account_registration(selected_account_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  auth_created_at timestamptz;
  profile_created_at timestamptz;
  existing_account_type text;
  existing_role public.app_role;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if selected_account_type is null or selected_account_type not in ('customer', 'merchant') then
    raise exception using errcode = '22023', message = 'invalid_account_type';
  end if;

  select u.created_at into auth_created_at
  from auth.users u
  where u.id = caller_id;

  select p.account_type, p.role, p.created_at
  into existing_account_type, existing_role, profile_created_at
  from public.profiles p
  where p.id = caller_id
  for update;

  if existing_account_type is null then
    raise exception using errcode = 'P0002', message = 'profile_unavailable';
  end if;

  if existing_role = 'admin'::public.app_role then
    raise exception using errcode = '42501', message = 'admin_account_type_immutable';
  end if;

  -- Idempotent retries for the selected type are safe, including after a redirect retry.
  if existing_account_type = selected_account_type then
    return true;
  end if;

  -- The function can only classify a freshly created OAuth identity. It cannot
  -- promote an older shopper account or change a merchant account back.
  if auth_created_at is null
    or auth_created_at < now() - interval '15 minutes'
    or profile_created_at < auth_created_at - interval '1 minute'
    or profile_created_at > auth_created_at + interval '1 minute' then
    raise exception using errcode = '42501', message = 'oauth_registration_expired';
  end if;

  if not exists (
    select 1 from auth.identities i
    where i.user_id = caller_id and i.provider not in ('email', 'phone')
  ) then
    raise exception using errcode = '42501', message = 'oauth_identity_required';
  end if;

  if existing_account_type <> 'customer' then
    raise exception using errcode = '42501', message = 'account_type_conflict';
  end if;

  update public.profiles
  set account_type = selected_account_type
  where id = caller_id and account_type = 'customer';

  if not found then
    raise exception using errcode = '42501', message = 'account_type_conflict';
  end if;

  return true;
end;
$function$;

revoke all on function public.complete_oauth_account_registration(text) from public, anon;
grant execute on function public.complete_oauth_account_registration(text) to authenticated;
