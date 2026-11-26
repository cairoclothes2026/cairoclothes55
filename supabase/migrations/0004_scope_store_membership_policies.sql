-- Membership-backed policies are only needed for signed-in users.
-- Keeping them off the anon role lets public catalog policies run without
-- requiring anon to read the private store_members table.

drop policy if exists stores_member_read on public.stores;
create policy stores_member_read on public.stores
  for select to authenticated
  using (
    exists (
      select 1 from public.store_members m
      where m.store_id = stores.id and m.profile_id = auth.uid()
    )
  );

drop policy if exists stores_member_update on public.stores;
create policy stores_member_update on public.stores
  for update to authenticated
  using (
    exists (
      select 1 from public.store_members m
      where m.store_id = stores.id and m.profile_id = auth.uid()
        and m.member_role in ('owner','manager')
    )
  )
  with check (
    exists (
      select 1 from public.store_members m
      where m.store_id = stores.id and m.profile_id = auth.uid()
        and m.member_role in ('owner','manager')
    )
  );

drop policy if exists store_members_read_self on public.store_members;
create policy store_members_read_self on public.store_members
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists products_member_read on public.products;
create policy products_member_read on public.products
  for select to authenticated
  using (
    exists (
      select 1 from public.store_members m
      where m.store_id = products.store_id and m.profile_id = auth.uid()
    )
  );

drop policy if exists products_member_insert on public.products;
create policy products_member_insert on public.products
  for insert to authenticated
  with check (
    exists (
      select 1 from public.store_members m
      where m.store_id = products.store_id and m.profile_id = auth.uid()
    )
  );

drop policy if exists products_member_update on public.products;
create policy products_member_update on public.products
  for update to authenticated
  using (
    exists (
      select 1 from public.store_members m
      where m.store_id = products.store_id and m.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.store_members m
      where m.store_id = products.store_id and m.profile_id = auth.uid()
    )
  );

drop policy if exists products_member_delete on public.products;
create policy products_member_delete on public.products
  for delete to authenticated
  using (
    exists (
      select 1 from public.store_members m
      where m.store_id = products.store_id and m.profile_id = auth.uid()
    )
  );

drop policy if exists coupons_member_manage on public.coupons;
create policy coupons_member_manage on public.coupons
  for all to authenticated
  using (
    exists (
      select 1 from public.store_members m
      where m.store_id = coupons.store_id and m.profile_id = auth.uid()
        and m.member_role in ('owner','manager')
    )
  )
  with check (
    exists (
      select 1 from public.store_members m
      where m.store_id = coupons.store_id and m.profile_id = auth.uid()
        and m.member_role in ('owner','manager')
    )
  );

drop policy if exists coupon_redemptions_store_read on public.coupon_redemptions;
create policy coupon_redemptions_store_read on public.coupon_redemptions
  for select to authenticated
  using (
    exists (
      select 1 from public.coupons c
      join public.store_members m on m.store_id = c.store_id
      where c.id = coupon_redemptions.coupon_id and m.profile_id = auth.uid()
    )
  );
