-- Store a shareable Google Maps location for public store pages.
alter table public.stores
  add column if not exists location_url text;

grant update(location_url) on public.stores to authenticated;
