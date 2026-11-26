set local lock_timeout = '2s';
create index if not exists legal_acceptances_document_version_idx
  on public.legal_acceptances(document_id, version);

alter policy products_member_insert on public.products
  with check (exists (
    select 1 from public.store_members m
    join public.stores s on s.id = m.store_id
    where m.store_id = products.store_id and m.profile_id = (select auth.uid())
      and m.member_role in ('owner', 'manager') and s.status = 'active'
  ));

alter policy products_member_update on public.products
  using (exists (
    select 1 from public.store_members m
    join public.stores s on s.id = m.store_id
    where m.store_id = products.store_id and m.profile_id = (select auth.uid())
      and m.member_role in ('owner', 'manager') and s.status = 'active'
  ))
  with check (exists (
    select 1 from public.store_members m
    join public.stores s on s.id = m.store_id
    where m.store_id = products.store_id and m.profile_id = (select auth.uid())
      and m.member_role in ('owner', 'manager') and s.status = 'active'
  ));

alter policy products_member_delete on public.products
  using (exists (
    select 1 from public.store_members m
    join public.stores s on s.id = m.store_id
    where m.store_id = products.store_id and m.profile_id = (select auth.uid())
      and m.member_role in ('owner', 'manager') and s.status = 'active'
  ));
