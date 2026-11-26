create function public.owner_product_click_counts(p_store_id uuid)
returns table(product_id uuid, clicks bigint)
language sql stable security definer set search_path = '' as $$
  select p.id, count(v.id)
  from public.stores s
  join public.products p on p.store_id = s.id
  left join public.product_views v on v.product_id = p.id
  where s.id = p_store_id and s.owner_id = (select auth.uid())
    and (select public.legal_session_has_access())
  group by p.id
$$;
revoke all on function public.owner_product_click_counts(uuid) from public, anon, authenticated, service_role;
grant execute on function public.owner_product_click_counts(uuid) to authenticated;
