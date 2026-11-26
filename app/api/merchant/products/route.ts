import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { productImageBucket, productImageExtension, productImageMaxBytes } from '@/lib/product-image';

import { attributeKeys, describeAttributes, options, type Attributes } from '@/lib/garment-attributes';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = new Set(['women', 'men', 'kids']);
const productFields = 'id,store_id,name_ar,name_en,description_ar,description_en,category,piece_type,colors,pattern,fabric,price_egp,discount_percent,sizes,images,available,updated_at';

type ProductInput = {
  attributes?: unknown;
  store_id?: unknown;
  product_id?: unknown;
  name_ar?: unknown;
  name_en?: unknown;
  description_ar?: unknown;
  description_en?: unknown;
  category?: unknown;
  price_egp?: unknown;
  discount_percent?: unknown;
  sizes?: unknown;
  image_url?: unknown;
  available?: unknown;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseProduct(body: ProductInput) {
  const nameAr = text(body.name_ar);
  const nameEn = text(body.name_en);
  const descriptionAr = text(body.description_ar);
  const descriptionEn = text(body.description_en);
  const category = text(body.category);
  const imageUrl = text(body.image_url);
  const price = typeof body.price_egp === 'number' ? body.price_egp : Number(body.price_egp);
  const discountPercent = body.discount_percent === undefined ? 0 : Number(body.discount_percent);
  let normalizedImageUrl = '';
  if (imageUrl) {
    try {
      const parsedUrl = new URL(imageUrl);
      if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) return null;
      normalizedImageUrl = parsedUrl.toString();
    } catch {
      return null;
    }
  }
  const sizes = Array.isArray(body.sizes)
    ? body.sizes.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 20)
    : [];

  if (!nameAr || nameAr.length > 120 || !nameEn || nameEn.length > 120
    || descriptionAr.length > 500 || descriptionEn.length > 500
    || !categories.has(category) || !Number.isFinite(price) || price < 0 || price > 10000000
    || !Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100
    || imageUrl.length > 1000
    || (body.available !== undefined && typeof body.available !== 'boolean')) {
    return null;
  }

  return {
    name_ar: nameAr,
    name_en: nameEn,
    description_ar: descriptionAr || null,
    description_en: descriptionEn || null,
    category,
    price_egp: price,
    discount_percent: discountPercent,
    sizes,
    images: normalizedImageUrl ? [normalizedImageUrl] : [],
    available: body.available ?? true,
    active: true,
  };
}

async function getSignedInUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: 'authentication_required' }, { status: 401 }) };
  return { supabase, user };
}

async function requireStoreManager(storeId: string, session?: Awaited<ReturnType<typeof getSignedInUser>>) {
  if (!uuidPattern.test(storeId)) {
    return { response: NextResponse.json({ error: 'invalid_store' }, { status: 400 }) };
  }

  const access = session ?? await getSignedInUser();
  if ('response' in access) return access;

  const { data: membership, error: membershipError } = await access.supabase
    .from('store_members')
    .select('member_role')
    .eq('store_id', storeId)
    .eq('profile_id', access.user.id)
    .maybeSingle();

  if (membershipError) return { response: NextResponse.json({ error: 'membership_unavailable' }, { status: 503 }) };
  if (!membership || !['owner', 'manager'].includes(membership.member_role)) {
    return { response: NextResponse.json({ error: 'store_access_denied' }, { status: 403 }) };
  }

  const { data: store, error: storeError } = await access.supabase
    .from('stores')
    .select('id,slug,name_ar,name_en,status,location_url')
    .eq('id', storeId)
    .maybeSingle();

  if (storeError) return { response: NextResponse.json({ error: 'store_unavailable' }, { status: 503 }) };
  if (!store) return { response: NextResponse.json({ error: 'store_not_found' }, { status: 404 }) };
  if (store.status !== 'active') {
    return { response: NextResponse.json({ error: 'store_not_active' }, { status: 409 }) };
  }

  return { ...access, store };
}

async function readPayload(request: Request): Promise<ProductInput | null> {
  try {
    const payload: unknown = await request.json();
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as ProductInput : null;
  } catch {
    return null;
  }
}

function checkOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin === request.nextUrl.origin);
}

export async function GET(request: NextRequest) {
  try {
    const access = await getSignedInUser();
    if ('response' in access) return access.response;

    const { data: memberships, error: membershipsError } = await access.supabase
      .from('store_members')
      .select('store_id,member_role')
      .eq('profile_id', access.user.id)
      .in('member_role', ['owner', 'manager']);

    if (membershipsError) return NextResponse.json({ error: 'membership_unavailable' }, { status: 503 });
    const storeIds = (memberships ?? []).map((membership) => membership.store_id);
    if (storeIds.length === 0) return NextResponse.json({ stores: [], products: [] });

    const { data: stores, error: storesError } = await access.supabase
      .from('stores')
      .select('id,slug,name_ar,name_en,status,location_url,address_ar,address_en,phone,whatsapp')
      .in('id', storeIds)
      .order('created_at', { ascending: false });
    if (storesError) return NextResponse.json({ error: 'stores_unavailable' }, { status: 503 });

    const roleByStore = new Map((memberships ?? []).map((membership) => [membership.store_id, membership.member_role]));
    const storesWithRole = (stores ?? []).map((store) => ({
      ...store,
      member_role: roleByStore.get(store.id) === 'owner' ? 'owner' : 'manager',
    }));

    const requestedStoreId = request.nextUrl.searchParams.get('store_id');
    if (requestedStoreId && !storeIds.includes(requestedStoreId)) {
      return NextResponse.json({ error: 'store_access_denied' }, { status: 403 });
    }

    const selectedIds = requestedStoreId ? [requestedStoreId] : storeIds;
    const activeIds = (stores ?? []).filter((store) => store.status === 'active' && selectedIds.includes(store.id)).map((store) => store.id);
    if (activeIds.length === 0) return NextResponse.json({ stores: storesWithRole, products: [] });

    const { data: products, error: productsError } = await access.supabase
      .from('products')
      .select('id,store_id,name_ar,name_en,description_ar,description_en,category,piece_type,colors,pattern,fabric,price_egp,discount_percent,sizes,images,available,updated_at')
      .in('store_id', activeIds)
      .order('updated_at', { ascending: false });

    if (productsError) return NextResponse.json({ error: 'products_unavailable' }, { status: 503 });
    if (requestedStoreId && roleByStore.get(requestedStoreId) === 'owner') {
      const counts = await access.supabase.rpc('owner_product_click_counts', { p_store_id: requestedStoreId });
      const byProduct = new Map((counts.data ?? []).map((row: { product_id: string; clicks: number }) => [row.product_id, row.clicks]));
      return NextResponse.json({ stores: storesWithRole, products: (products ?? []).map(p => ({
        ...p, clicks: byProduct.get(p.id) ?? null,
      })) }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    return NextResponse.json({ stores: storesWithRole, products: products ?? [] });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}

async function saveProduct(request: NextRequest, editing: boolean) {
  if (!checkOrigin(request)) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  const session = await getSignedInUser();
  if ('response' in session) return session.response;
  let body: ProductInput | null;
  let image: Blob | null = null;
  if (request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) {
    if (Number(request.headers.get('content-length')) > productImageMaxBytes + 64 * 1024) {
      return NextResponse.json({ error: 'invalid_image' }, { status: 413 });
    }
    const form = await request.formData().catch(() => null);
    const payload = form?.get('product');
    if (typeof payload !== 'string' || payload.length > 16 * 1024) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    body = await readPayload(new Request(request.url, { method: 'POST', body: payload }));
    const file = form?.get('image');
    if (!(file instanceof Blob) || !productImageExtension(file)) {
      return NextResponse.json({ error: 'invalid_image' }, { status: 400 });
    }
    image = file;
  } else {
    body = await readPayload(request);
  }
  if (!body) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const storeId = text(body.store_id);
  const productId = text(body.product_id);
  if (!editing && !image) return NextResponse.json({ error: 'image_required' }, { status: 400 });
  const product = parseProduct(body);
  const supplied = body.attributes;
  let metadata: { piece_type: string; colors: string[]; pattern: string; fabric: string } | undefined;
  if (supplied !== undefined || !editing) {
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) {
      return NextResponse.json({ error: 'invalid_product' }, { status: 400 });
    }
    const values = supplied as Attributes;
    const legacyEdit = editing && attributeKeys.every(key => values[key] === '');
    if (!legacyEdit) {
      if (!attributeKeys.every(key => typeof values[key] === 'string' && Object.hasOwn(options[key], values[key]))) {
        return NextResponse.json({ error: 'invalid_product' }, { status: 400 });
      }
      metadata = { piece_type: values.piece_type, colors: [values.color], pattern: values.pattern, fabric: values.fabric };
      if (product) {
        product.description_ar = describeAttributes(values, 'ar');
        product.description_en = describeAttributes(values, 'en');
      }
    }
  }
  if (!product || (editing && !uuidPattern.test(productId))) {
    return NextResponse.json({ error: 'invalid_product' }, { status: 400 });
  }

  try {
    const access = await requireStoreManager(storeId, session);
    if (!('store' in access)) return access.response;
    if (editing) {
      const { data: existing, error } = await access.supabase.from('products').select('id,images')
        .eq('id', productId).eq('store_id', storeId).maybeSingle();
      if (error) return NextResponse.json({ error: 'products_unavailable' }, { status: 503 });
      if (!existing) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
      if (!image && !existing.images?.[0]?.trim()) return NextResponse.json({ error: 'image_required' }, { status: 400 });
    }
    const bucket = access.supabase.storage.from(productImageBucket);
    let uploadedPath = '';
    if (image) {
      const path = `${access.store.id}/${crypto.randomUUID()}.${productImageExtension(image)}`;
      const { error } = await bucket.upload(path, image, { cacheControl: '3600', contentType: image.type, upsert: false });
      if (error) return NextResponse.json({ error: 'image_upload_failed' }, { status: 502 });
      uploadedPath = path;
      product.images = [bucket.getPublicUrl(path).data.publicUrl];
    }
    const products = access.supabase.from('products');
    const { data, error, status } = editing
      ? await products.update({ ...product, ...metadata }).eq('id', productId).eq('store_id', storeId).select(productFields).maybeSingle()
      : await products.insert({ ...product, ...metadata, store_id: storeId }).select(productFields).single();
    // A network/server failure may have happened after the product was saved.
    if (uploadedPath && (error ? status >= 400 && status < 500 : !data)) {
      await bucket.remove([uploadedPath]).catch(() => undefined);
    }
    if (error) return NextResponse.json({ error: editing ? 'product_update_failed' : 'product_save_failed' }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
    return NextResponse.json({ product: data }, { status: editing ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  return saveProduct(request, false);
}

export async function PATCH(request: NextRequest) {
  return saveProduct(request, true);
}

export async function DELETE(request: NextRequest) {
  if (!checkOrigin(request)) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  const body = await readPayload(request);
  if (!body) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const storeId = text(body.store_id);
  const productId = text(body.product_id);
  if (!uuidPattern.test(productId)) return NextResponse.json({ error: 'invalid_product' }, { status: 400 });

  try {
    const access = await requireStoreManager(storeId);
    if ('response' in access) return access.response;
    const { data, error } = await access.supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('store_id', storeId)
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'product_delete_failed' }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
