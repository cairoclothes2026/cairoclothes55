// Shared demo filter: exclude exact fictional seed IDs from supabase/seed/demo.sql
// No database mutations — this only filters in-memory after public reads.

export const DEMO_STORE_IDS = new Set([
  '00000000-0000-0000-0000-000000000101', // style-house
  '00000000-0000-0000-0000-000000000102', // urban-cairo
  '00000000-0000-0000-0000-000000000103', // closet-9
]);

export const DEMO_PRODUCT_IDS = new Set([
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000203',
  '00000000-0000-0000-0000-000000000204',
  '00000000-0000-0000-0000-000000000205',
  '00000000-0000-0000-0000-000000000206',
]);

export const DEMO_COUPON_IDS = new Set([
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000302',
]);

export function filterDemoStores<T extends { id: string }>(stores: T[]): T[] {
  return stores.filter((store) => !DEMO_STORE_IDS.has(store.id));
}

export function filterDemoProducts<T extends { id: string; store_id?: string; storeId?: string }>(products: T[]): T[] {
  return products.filter((product) =>
    !DEMO_PRODUCT_IDS.has(product.id) &&
    !DEMO_STORE_IDS.has(product.store_id ?? product.storeId ?? '')
  );
}

export function filterDemoCoupons<T extends { id?: string; store_id?: string; product_id?: string | null }>(
  coupons: T[],
  survivingStoreIds: Set<string>,
  survivingProductIds: Set<string>
): T[] {
  return coupons.filter((coupon) =>
    !DEMO_COUPON_IDS.has(coupon.id ?? '') &&
    !DEMO_STORE_IDS.has(coupon.store_id ?? '') &&
    survivingStoreIds.has(coupon.store_id ?? '') &&
    (coupon.product_id === null || coupon.product_id === undefined || survivingProductIds.has(coupon.product_id))
  );
}