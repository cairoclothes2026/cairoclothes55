import { notFound } from 'next/navigation';
import { StoreProfile } from '@/components/StoreProfile';
import type { Locale, Store, CatalogData } from '@/lib/catalog';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getPublicCatalog } from '@/lib/catalog-server';
import { homePath } from '@/lib/home-path';
import { absoluteSiteUrl, canIndexSite, localizedAlternates, SITE_ORIGIN } from '@/lib/site-seo';
import { catalogImageUrl } from '@/lib/catalog-image-url';
import { JsonLd } from '@/components/JsonLd';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  await connection();
  const catalog = await getPublicCatalog();
  const store = catalog?.stores.find((item) => item.slug === slug);
  if (catalog?.source === 'database' && !store) notFound();
  if (!store) {
    return { title: locale === 'ar' ? 'صفحة المحل' : 'Store profile', robots: { index: false, follow: true } };
  }

  const ar = locale === 'ar';
  const name = ar ? store.ar : store.en;
  const area = catalog?.areas.find((item) => item.id === store.areaId);
  const areaName = area ? (ar ? area.ar : area.en) : (ar ? 'القاهرة' : 'Cairo');
  const route = `/${locale}/stores/${slug}`;
  const title = ar ? `${name} في ${areaName}، القاهرة` : `${name} in ${areaName}, Cairo`;
  const description = ar
    ? `${store.descriptionAr || `تعرّف على ${name}`} في ${areaName}، القاهرة. استكشف المنتجات المنشورة والعنوان، وتأكد من التفاصيل مع المحل قبل الزيارة.`
    : `${store.descriptionEn || `Discover ${name}`} in ${areaName}, Cairo. Browse published products and the store location, then confirm details before visiting.`;
  const image = SITE_ORIGIN ? new URL(catalogImageUrl(store.image, 1000), `${SITE_ORIGIN}/`).toString() : undefined;

  return {
    title,
    description,
    alternates: SITE_ORIGIN ? { canonical: route, ...localizedAlternates(`/ar/stores/${slug}`, `/en/stores/${slug}`) } : undefined,
    robots: { index: canIndexSite() && catalog?.source === 'database', follow: true },
    openGraph: {
      type: 'website', title, description, locale: ar ? 'ar_EG' : 'en_US',
      ...(SITE_ORIGIN ? { url: new URL(route, `${SITE_ORIGIN}/`).toString() } : {}),
      ...(image ? { images: [{ url: image, alt: name }] } : {}),
    },
  };
}

function buildStoreSchema(locale: Locale, store: Store, catalog: CatalogData | null | undefined, SITE_ORIGIN: string | undefined, route: string) {
  const ar = locale === 'ar';
  const storeName = ar ? store.ar : store.en;
  const storeUrl = SITE_ORIGIN ? new URL(route, `${SITE_ORIGIN}/`).toString() : undefined;
  const storeImage = store.image ? (SITE_ORIGIN ? new URL(catalogImageUrl(store.image, 1000), `${SITE_ORIGIN}/`).toString() : undefined) : undefined;
  const area = catalog?.areas.find((item) => item.id === store.areaId);
  const addressAr = store.addressAr;
  const addressEn = store.addressEn;
  const phone = store.phone; // Not currently in catalog but available in DB
  const locationUrl = store.locationUrl;

  const address = {
    '@type': 'PostalAddress',
    streetAddress: ar ? addressAr : addressEn,
    addressLocality: ar ? (area?.ar || 'القاهرة') : (area?.en || 'Cairo'),
    addressRegion: 'Cairo Governorate',
    addressCountry: 'EG',
  };

  const geo = (store.latitude && store.longitude) ? {
    '@type': 'GeoCoordinates',
    latitude: store.latitude,
    longitude: store.longitude,
  } : undefined;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: ar ? 'الرئيسية' : 'Home', item: absoluteSiteUrl(homePath(locale)) },
          { '@type': 'ListItem', position: 2, name: ar ? 'دليل المحلات' : 'Store directory', item: new URL(`/${locale}/stores`, `${SITE_ORIGIN}/`).toString() },
          { '@type': 'ListItem', position: 3, name: storeName, item: storeUrl },
        ],
      },
      {
        '@type': 'ClothingStore',
        '@id': storeUrl ? `${storeUrl}#store` : undefined,
        name: storeName,
        description: ar ? store.descriptionAr : store.descriptionEn,
        url: storeUrl,
        image: storeImage ? [storeImage] : undefined,
        telephone: phone,
        address,
        geo,
        priceRange: '$$',
        ...(locationUrl ? { maps: locationUrl } : {}),
        ...(store.openingHoursSpecification ? { openingHoursSpecification: store.openingHoursSpecification } : {}),
      },
    ],
  };
}

export default async function StorePage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  await connection();
  const catalog = await getPublicCatalog();
  const store = catalog?.stores.find((item) => item.slug === slug);
  if (catalog?.source === 'database' && !store) notFound();

  const route = `/${locale}/stores/${slug}`;
  const storeName = store && (locale === 'ar' ? store.ar : store.en);
  const schema = canIndexSite() && catalog?.source === 'database' && store && storeName && SITE_ORIGIN
    ? buildStoreSchema(locale, store, catalog, SITE_ORIGIN, route)
    : null;

  return <>{schema && <JsonLd data={schema} />}<StoreProfile locale={locale as Locale} slug={slug} initialCatalog={catalog} /></>;
}
