import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogData, Product, Store } from './catalog';
import { sharedStoreContact } from './whatsapp';
import { filterDemoStores, filterDemoProducts, filterDemoCoupons } from './demo-filter';

type AreaRow = { id: string; name_ar: string; name_en: string };
type StoreRow = { id: string; slug: string; name_ar: string; name_en: string; description_ar: string | null; description_en: string | null; area_id: string; address_ar: string; address_en: string; location_url: string | null; whatsapp: string | null; phone: string | null; latitude: number | null; longitude: number | null };
type ProductRow = { updated_at: string; piece_type: string | null; colors: string[]; pattern: string | null; fabric: string | null; id: string; store_id: string; name_ar: string; name_en: string; description_ar: string | null; description_en: string | null; category: Product['category']; price_egp: number | string; discount_percent: number | string; sizes: string[]; images: string[]; available: boolean };
type CouponRow = { id: string; store_id: string; product_id: string | null; title_ar: string; title_en: string; description_ar: string | null; description_en: string | null; code: string; discount_percent: number | string };

const areaFields = 'id,name_ar,name_en';
const storeFields = 'id,slug,name_ar,name_en,description_ar,description_en,area_id,address_ar,address_en,location_url,phone,whatsapp,latitude,longitude';
const productFields = 'id,store_id,name_ar,name_en,description_ar,description_en,category,piece_type,colors,pattern,fabric,price_egp,discount_percent,sizes,images,available,updated_at';
const couponFields = 'id,store_id,product_id,title_ar,title_en,description_ar,description_en,code,discount_percent';

function assemble(areaRows: AreaRow[], storeRows: StoreRow[], productRows: ProductRow[], coupons: CouponRow[]): CatalogData {
  const areas = areaRows.map((area) => ({ id: area.id, ar: area.name_ar, en: area.name_en }));

  // Exclude fictional demo seed records
  storeRows = filterDemoStores(storeRows);
  const survivingStoreIds = new Set(storeRows.map((s) => s.id));
  productRows = filterDemoProducts(productRows);
  const survivingProductIds = new Set(productRows.map((p) => p.id));
  coupons = filterDemoCoupons(coupons, survivingStoreIds, survivingProductIds);

  const productOffers = new Map(coupons.filter((coupon) => coupon.product_id).map((coupon) => [coupon.product_id, Number(coupon.discount_percent)]));
  const storesById = new Map(storeRows.map((row) => [row.id, row]));
  const products: Product[] = productRows.map((product) => {
    const store = storesById.get(product.store_id);
    return {
      id: product.id,
      ar: product.name_ar,
      en: product.name_en,
      piece_type: product.piece_type ?? undefined,
      colors: product.colors ?? [],
      pattern: product.pattern ?? undefined,
      fabric: product.fabric ?? undefined,
      descriptionAr: product.description_ar ?? undefined,
      descriptionEn: product.description_en ?? undefined,
      category: product.category,
      price: Number(product.price_egp),
      discountPercent: Number(product.discount_percent ?? 0),
      storeId: product.store_id,
      areaId: store?.area_id ?? '',
      color: '#e5e0d6',
      updatedAt: product.updated_at,
      image: product.images?.[0] ?? undefined,
      sizes: product.sizes ?? [],
      available: product.available,
      offer: productOffers.get(product.id),
    };
  }).filter((product) => product.areaId);

  const storeInventory = new Map<string, { count: number; image?: string }>();
  for (const product of products) {
    const existing = storeInventory.get(product.storeId);
    if (existing) existing.count++;
    else storeInventory.set(product.storeId, { count: 1, image: product.image });
  }
  const firstCoupon = new Map<string, CouponRow>();
  for (const coupon of coupons) {
    if (!firstCoupon.has(coupon.store_id)) firstCoupon.set(coupon.store_id, coupon);
  }
  const stores: Store[] = storeRows.map((store) => {
    const storeProducts = storeInventory.get(store.id);
    const contact = sharedStoreContact(store);
    const sampleCoupon = firstCoupon.get(store.id);
    const offer = sampleCoupon ? {
      titleAr: sampleCoupon.title_ar,
      titleEn: sampleCoupon.title_en,
      descriptionAr: sampleCoupon.description_ar ?? '',
      descriptionEn: sampleCoupon.description_en ?? '',
      code: sampleCoupon.code,
      discountPercent: Number(sampleCoupon.discount_percent),
    } : undefined;
    return {
      id: store.id,
      slug: store.slug,
      ar: store.name_ar,
      en: store.name_en,
      areaId: store.area_id,
      addressAr: store.address_ar,
      addressEn: store.address_en,
      locationUrl: store.location_url ?? undefined,
      latitude: store.latitude ?? undefined,
      longitude: store.longitude ?? undefined,
      whatsapp: contact,
      phone: contact ?? store.phone ?? undefined,
      products: storeProducts?.count ?? 0,
      image: storeProducts?.image ?? '/images/store-placeholder.svg',
      descriptionAr: store.description_ar ?? '',
      descriptionEn: store.description_en ?? '',
      offer,
    };
  });

  return { areas, stores, products, source: 'database' };
}

type Page<T> = { data: T[] | null; error: { message: string } | null; count: number | null };

async function readPages<T>(fetchPage: (offset: number, end: number, first: boolean) => PromiseLike<Page<T>>) {
  const rows: T[] = [];
  let total = Infinity;
  while (rows.length < total) {
    const page = await fetchPage(rows.length, rows.length + 499, rows.length === 0);
    if (page.error) throw new Error(page.error.message);
    if (!page.data?.length) break;
    if (page.count !== null) total = page.count;
    rows.push(...page.data);
  }
  return rows;
}

export async function readCatalog(db: SupabaseClient): Promise<CatalogData> {
  const [areas, stores, products, coupons] = await Promise.all([
    readPages<AreaRow>((a, b, first) => db.from('areas').select(areaFields, first ? { count: 'exact' } : {}).eq('active', true).order('name_en').order('id').range(a, b)),
    readPages<StoreRow>((a, b, first) => db.from('stores').select(storeFields, first ? { count: 'exact' } : {}).eq('status', 'active').order('name_en').order('id').range(a, b)),
    readPages<ProductRow>((a, b, first) => db.from('products').select(productFields, first ? { count: 'exact' } : {}).eq('active', true).order('created_at', { ascending: false }).order('id').range(a, b)),
    readPages<CouponRow>((a, b, first) => db.from('coupons').select(couponFields, first ? { count: 'exact' } : {}).eq('active', true).order('id').range(a, b)).catch(() => []),
  ]);
  return assemble(areas, stores, products, coupons);
}

export async function readProduct(db: SupabaseClient, id: string): Promise<CatalogData> {
  const empty = () => assemble([], [], [], []);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return empty();
  const product = await db.from('products').select(productFields).eq('id', id).eq('active', true).maybeSingle<ProductRow>();
  if (product.error) throw new Error('product_unavailable');
  if (!product.data || !filterDemoProducts([product.data]).length) return empty();
  const store = await db.from('stores').select(storeFields).eq('id', product.data.store_id).eq('status', 'active').maybeSingle<StoreRow>();
  if (store.error) throw new Error('store_unavailable');
  if (!store.data) return empty();
  const area = await db.from('areas').select(areaFields).eq('id', store.data.area_id).eq('active', true).maybeSingle<AreaRow>();
  return assemble(area.data ? [area.data] : [], [store.data], [product.data], []);
}
