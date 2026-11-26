import { notFound } from 'next/navigation';
import { ProductProfile } from '@/components/ProductProfile';
import type { CatalogData, Locale } from '@/lib/catalog';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getPublicCatalog } from '@/lib/catalog-server';
import { canIndexSite, localizedAlternates, SITE_ORIGIN } from '@/lib/site-seo';
import { catalogImageUrl } from '@/lib/catalog-image-url';
import { JsonLd } from '@/components/JsonLd';

type PageProps = { params: Promise<{ locale: string; id: string }> };

function absoluteImage(image: string) {
  try {
    return new URL(catalogImageUrl(image, 1200), SITE_ORIGIN ? `${SITE_ORIGIN}/` : undefined).toString();
  } catch {
    return undefined;
  }
}

function mapCategoryToSchema(category: 'women' | 'men' | 'kids'): string {
  switch (category) {
    case 'women': return 'https://schema.org/WomensClothing';
    case 'men': return 'https://schema.org/MensClothing';
    case 'kids': return 'https://schema.org/ChildrensClothing';
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  await connection();
  const catalog = await getPublicCatalog(id);
  const product = catalog?.products.find((item) => item.id === id);
  const store = product && catalog?.stores.find((item) => item.id === product.storeId);
  if (catalog?.source === 'database' && (!product || !store)) notFound();
  if (!product || !store) {
    return { title: locale === 'ar' ? 'تفاصيل المنتج' : 'Product details', robots: { index: false, follow: true } };
  }

  const ar = locale === 'ar';
  const name = ar ? product.ar : product.en;
  const storeName = ar ? store.ar : store.en;
  const area = catalog?.areas.find((item) => item.id === store.areaId);
  const areaName = area ? (ar ? area.ar : area.en) : (ar ? 'القاهرة' : 'Cairo');
  const price = Math.round(product.price * (1 - Number(product.discountPercent ?? 0) / 100));
  const route = `/${locale}/products/${id}`;
  const title = ar ? `${name} في ${storeName}، القاهرة` : `${name} at ${storeName}, Cairo`;
  const description = ar
    ? `اكتشف ${name} لدى ${storeName} في ${areaName}، القاهرة. السعر ${price} جنيهًا؛ أكّد المقاس والتوفر مع المحل قبل الزيارة.`
    : `Find ${name} at ${storeName} in ${areaName}, Cairo. Listed at EGP ${price}; confirm size and availability with the store before visiting.`;
  const image = product.image ? absoluteImage(product.image) : undefined;

  return {
    title,
    description,
    alternates: SITE_ORIGIN ? { canonical: route, ...localizedAlternates(`/ar/products/${id}`, `/en/products/${id}`) } : undefined,
    robots: { index: canIndexSite() && catalog?.source === 'database', follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      locale: ar ? 'ar_EG' : 'en_US',
      ...(SITE_ORIGIN ? { url: new URL(route, `${SITE_ORIGIN}/`).toString() } : {}),
      ...(image ? { images: [{ url: image, alt: name }] } : {}),
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { locale, id } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  await connection();
  const catalog: CatalogData | null = await getPublicCatalog(id);
  const product = catalog?.products.find((item) => item.id === id);
  const store = product && catalog?.stores.find((item) => item.id === product.storeId);
  if (catalog?.source === 'database' && (!product || !store)) notFound();

  const name = product && (locale === 'ar' ? product.ar : product.en);
  const price = product ? Math.round(product.price * (1 - Number(product.discountPercent ?? 0) / 100)) : 0;
  const productUrl = SITE_ORIGIN ? new URL(`/${locale}/products/${id}`, `${SITE_ORIGIN}/`).toString() : undefined;
  const storeUrl = store ? (SITE_ORIGIN ? new URL(`/${locale}/stores/${store.slug}`, `${SITE_ORIGIN}/`).toString() : undefined) : undefined;
  const schema = canIndexSite() && catalog?.source === 'database' && product && name && productUrl
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name,
        sku: product.id,
        brand: {
          '@type': 'Brand',
          name: store && (locale === 'ar' ? store.ar : store.en),
        },
        ...(product.descriptionAr || product.descriptionEn ? { description: locale === 'ar' ? product.descriptionAr : product.descriptionEn } : {}),
        ...(product.image ? { image: [absoluteImage(product.image)] } : {}),
        category: product.category,
        additionalType: mapCategoryToSchema(product.category),
        color: product.color,
        size: product.sizes.length > 0 ? product.sizes.map((size) => ({
          '@type': 'SizeSpecification',
          name: size,
        })) : undefined,
        // This is an in-store discovery listing; purchase is completed at the store, not through Cairo Clothes
        offers: {
          '@type': 'Offer',
          url: productUrl,
          price,
          priceCurrency: 'EGP',
          availability: product.available ? 'https://schema.org/InStoreOnly' : 'https://schema.org/OutOfStock',
          seller: store ? {
            '@type': 'ClothingStore',
            name: locale === 'ar' ? store.ar : store.en,
            url: storeUrl,
            address: store.addressAr || store.addressEn ? {
              '@type': 'PostalAddress',
              streetAddress: locale === 'ar' ? store.addressAr : store.addressEn,
              addressLocality: 'Cairo',
              addressCountry: 'EG',
            } : undefined,
          } : undefined,
          description: locale === 'ar'
            ? 'السعر للإشارة فقط؛ الشراء يتم في المحل مباشرة. أكّد السعر والتوفر مع المحل قبل الزيارة.'
            : 'Price for reference only; purchase is made in-store directly. Confirm price and availability with the store before visiting.',
        },
      }
    : null;

  return <>{schema && <JsonLd data={schema} />}<ProductProfile locale={locale as Locale} id={id} initialCatalog={catalog} /></>;
}