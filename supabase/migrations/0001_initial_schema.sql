-- Cairo Clothes starter schema for Supabase (PostgreSQL + Supabase Auth).
-- Admin moderation must run on a trusted server. Never expose a service-role key in the browser.
create extension if not exists pgcrypto;

create type public.app_role as enum ('customer','admin');
create type public.store_status as enum ('pending','active','paused','rejected');
create type public.product_category as enum ('women','men','kids');
create type public.coupon_redemption_status as enum ('issued','presented','redeemed','void');

create table public.areas (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  city_ar text not null default 'القاهرة',
  city_en text not null default 'Cairo',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'customer',
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  area_id text not null references public.areas(id),
  address_ar text not null,
  address_en text not null,
  contact_name text,
  phone text,
  whatsapp text,
  latitude double precision,
  longitude double precision,
  status public.store_status not null default 'pending',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_members (
  store_id uuid not null references public.stores(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'manager' check (member_role in ('owner','manager','editor')),
  created_at timestamptz not null default now(),
  primary key (store_id, profile_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  category public.product_category not null,
  price_egp numeric(10,2) not null check (price_egp >= 0),
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  images text[] not null default '{}',
  available boolean not null default true,
  availability_updated_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Store offers are secondary to product and store discovery. Redemption happens in person.
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title_ar text not null,
  title_en text not null,
  description_ar text,
  description_en text,
  code text not null unique,
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 100),
  starts_at timestamptz,
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  customer_profile_id uuid references public.profiles(id) on delete set null,
  verified_by_profile_id uuid references public.profiles(id) on delete set null,
  status public.coupon_redemption_status not null default 'issued',
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create table public.favorites (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, product_id)
);

create table public.product_views (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  session_id text,
  created_at timestamptz not null default now()
);

create index products_store_active_idx on public.products(store_id, active, available);
create index products_category_idx on public.products(category);
create index stores_area_status_idx on public.stores(area_id, status);
create index coupons_store_active_idx on public.coupons(store_id, active, expires_at);
create index coupon_redemptions_coupon_status_idx on public.coupon_redemptions(coupon_id, status);

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger stores_set_updated_at before update on public.stores for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.add_store_owner_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null then
    insert into public.store_members(store_id, profile_id, member_role)
    values (new.id, new.owner_id, 'owner') on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger stores_add_owner_member after insert on public.stores for each row execute function public.add_store_owner_member();

alter table public.areas enable row level security;
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.products enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.favorites enable row level security;
alter table public.product_views enable row level security;

create policy areas_public_read on public.areas for select using (active);
create policy profiles_read_self on public.profiles for select using (id = auth.uid());
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy stores_public_read on public.stores for select using (status = 'active');
create policy stores_member_read on public.stores for select using (
  exists (select 1 from public.store_members m where m.store_id = stores.id and m.profile_id = auth.uid())
);
create policy stores_submit_pending on public.stores for insert with check (status = 'pending' and owner_id = auth.uid());
create policy stores_member_update on public.stores for update
  using (exists (select 1 from public.store_members m where m.store_id = stores.id and m.profile_id = auth.uid() and m.member_role in ('owner','manager')))
  with check (exists (select 1 from public.store_members m where m.store_id = stores.id and m.profile_id = auth.uid() and m.member_role in ('owner','manager')));

create policy store_members_read_self on public.store_members for select using (profile_id = auth.uid());
create policy products_public_read on public.products for select using (
  active and exists (select 1 from public.stores s where s.id = products.store_id and s.status = 'active')
);
create policy products_member_read on public.products for select using (
  exists (select 1 from public.store_members m where m.store_id = products.store_id and m.profile_id = auth.uid())
);
create policy products_member_insert on public.products for insert with check (
  exists (select 1 from public.store_members m where m.store_id = products.store_id and m.profile_id = auth.uid())
);
create policy products_member_update on public.products for update
  using (exists (select 1 from public.store_members m where m.store_id = products.store_id and m.profile_id = auth.uid()))
  with check (exists (select 1 from public.store_members m where m.store_id = products.store_id and m.profile_id = auth.uid()));
create policy products_member_delete on public.products for delete using (
  exists (select 1 from public.store_members m where m.store_id = products.store_id and m.profile_id = auth.uid())
);

create policy coupons_public_read on public.coupons for select using (
  active and (starts_at is null or starts_at <= now()) and (expires_at is null or expires_at > now())
  and exists (select 1 from public.stores s where s.id = coupons.store_id and s.status = 'active')
);
create policy coupons_member_manage on public.coupons for all
  using (exists (select 1 from public.store_members m where m.store_id = coupons.store_id and m.profile_id = auth.uid() and m.member_role in ('owner','manager')))
  with check (exists (select 1 from public.store_members m where m.store_id = coupons.store_id and m.profile_id = auth.uid() and m.member_role in ('owner','manager')));
create policy coupon_redemptions_store_read on public.coupon_redemptions for select using (
  exists (select 1 from public.coupons c join public.store_members m on m.store_id = c.store_id
    where c.id = coupon_redemptions.coupon_id and m.profile_id = auth.uid())
);

create policy favorites_self_manage on public.favorites for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy product_views_insert_visible on public.product_views for insert with check (
  (profile_id is null or profile_id = auth.uid()) and exists (
    select 1 from public.products p join public.stores s on s.id = p.store_id
    where p.id = product_views.product_id and p.active and s.status = 'active'
  )
);

-- Least-privilege table access. Admin actions and redemption writes belong in trusted server code.
revoke all on public.areas, public.profiles, public.stores, public.store_members, public.products,
  public.coupons, public.coupon_redemptions, public.favorites, public.product_views from anon, authenticated;
grant select on public.areas, public.stores, public.products, public.coupons to anon, authenticated;
grant select, update(full_name, preferred_locale) on public.profiles to authenticated;
grant insert on public.stores to authenticated;
grant update(name_ar, name_en, description_ar, description_en, area_id, address_ar, address_en, contact_name, phone, whatsapp, latitude, longitude)
  on public.stores to authenticated;
grant select on public.store_members, public.coupon_redemptions to authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert, update, delete on public.coupons to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant insert on public.product_views to anon, authenticated;
grant usage, select on sequence public.product_views_id_seq to anon, authenticated;
