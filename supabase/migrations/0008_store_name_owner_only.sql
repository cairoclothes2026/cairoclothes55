-- Only a store owner can change the store's public Arabic or English name.
-- Managers keep their existing permissions for other store details.
create or replace function public.require_store_owner_for_name_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.name_ar is distinct from old.name_ar or new.name_en is distinct from old.name_en)
    and auth.uid() is not null
    and not exists (
      select 1
      from public.store_members m
      where m.store_id = old.id
        and m.profile_id = auth.uid()
        and m.member_role = 'owner'
    ) then
    raise exception using
      errcode = '42501',
      message = 'only_store_owner_can_change_name';
  end if;

  return new;
end;
$$;

drop trigger if exists stores_owner_only_name_change on public.stores;
create trigger stores_owner_only_name_change
before update of name_ar, name_en on public.stores
for each row execute function public.require_store_owner_for_name_change();
