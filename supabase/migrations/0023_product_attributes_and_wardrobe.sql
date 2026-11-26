-- Existing products retain their descriptions and can be classified by their merchants.
alter table public.products
  add column piece_type text check (piece_type in ('T-shirt', 'Shirt', 'Polo', 'Blouse', 'Top', 'Trousers', 'Jeans', 'Shorts', 'Skirt', 'Dress', 'Sweatshirt', 'Hoodie', 'Sweater', 'Cardigan', 'Jacket', 'Blazer', 'Coat', 'Suit', 'Set', 'Abaya', 'Pyjamas', 'Sportswear', 'Other')),
  add column pattern text check (pattern in ('Solid', 'Striped', 'Checked', 'Graphic', 'Floral', 'Polka dot', 'Geometric', 'Camouflage', 'Embroidered', 'Other')),
  add column fabric text check (fabric in ('Cotton', 'Linen', 'Denim', 'Wool', 'Silk', 'Satin', 'Chiffon', 'Polyester', 'Viscose', 'Nylon', 'Leather', 'Faux leather', 'Velvet', 'Blend', 'Other'));

create table public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  piece_type text not null check (piece_type in ('T-shirt', 'Shirt', 'Polo', 'Blouse', 'Top', 'Trousers', 'Jeans', 'Shorts', 'Skirt', 'Dress', 'Sweatshirt', 'Hoodie', 'Sweater', 'Cardigan', 'Jacket', 'Blazer', 'Coat', 'Suit', 'Set', 'Abaya', 'Pyjamas', 'Sportswear', 'Other')),
  color text not null check (color in ('Black', 'White', 'Navy', 'Blue', 'Sky blue', 'Grey', 'Beige', 'Ivory', 'Brown', 'Burgundy', 'Red', 'Pink', 'Purple', 'Green', 'Olive', 'Yellow', 'Orange', 'Gold', 'Silver', 'Multicolour', 'Other')),
  created_at timestamptz not null default now()
);
create index wardrobe_owner_created on public.wardrobe_items(owner_id, created_at desc, id);
alter table public.wardrobe_items enable row level security;
revoke all on public.wardrobe_items from public, anon, authenticated;
grant select, delete on public.wardrobe_items to authenticated;
grant insert (id,owner_id,piece_type,color) on public.wardrobe_items to authenticated;
create policy shopper_owns_wardrobe on public.wardrobe_items for all to authenticated
using (owner_id = (select auth.uid()) and (select public.legal_session_has_access())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.account_type = 'customer' and p.shopper_deleted_at is null))
with check (owner_id = (select auth.uid()) and (select public.legal_session_has_access())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.account_type = 'customer' and p.shopper_deleted_at is null));
