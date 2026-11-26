create function public.require_new_product_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  object_path text := substring(new.images[1] from '^https://njngevsrmxecrpwfhzdx[.]supabase[.]co/storage/v1/object/public/product-images/(.+)$');
begin
  if object_path is null or split_part(object_path, '/', 1) <> new.store_id::text
    or not exists (select 1 from storage.objects where bucket_id = 'product-images' and name = object_path) then
    raise exception 'product_image_required' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.require_new_product_photo() from public, anon, authenticated, service_role;
create trigger require_photo_on_product_creation before insert on public.products
for each row execute function public.require_new_product_photo();
