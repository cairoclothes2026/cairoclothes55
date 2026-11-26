-- Existing profiles and email registrations already have a chosen type.
-- A new social sign-in may choose its type once during registration.
alter table public.profiles
  add column account_type_locked boolean not null default true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := coalesce(nullif(new.raw_app_meta_data ->> 'provider', ''), 'email');
  v_social boolean := v_provider not in ('email', 'phone');
begin
  insert into public.profiles(id, full_name, account_type, account_type_locked)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case when not v_social and new.raw_user_meta_data ->> 'account_type' = 'merchant'
      then 'merchant' else 'customer' end,
    not v_social
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

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

revoke all on function public.complete_oauth_account_registration(text) from public, anon;
grant execute on function public.complete_oauth_account_registration(text) to authenticated;
