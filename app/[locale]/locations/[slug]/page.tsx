import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getPublicCatalog } from '@/lib/catalog-server';
import { homePath } from '@/lib/home-path';
import { absoluteSiteUrl, canIndexSite, localizedAlternates, shouldIndexPage, SITE_ORIGIN } from '@/lib/site-seo';
import { JsonLd } from '@/components/JsonLd';
import { PageBrand } from '@/components/PageBrand';
import { CatalogImage } from '@/components/CatalogImage';
import type { Area } from '@/lib/catalog';
import type { CatalogData } from '@/lib/catalog';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

const AREA_MAP: Record<string, Area> = {
  'nasr-city': { id: 'nasr-city', ar: 'مدينة نصر', en: 'Nasr City' },
  'new-cairo': { id: 'new-cairo', ar: 'التجمع', en: 'New Cairo' },
  'heliopolis': { id: 'heliopolis', ar: 'مصر الجديدة', en: 'Heliopolis' },
  'maadi': { id: 'maadi', ar: 'المعادي', en: 'Maadi' },
  'mohandessin': { id: 'mohandessin', ar: 'المهندسين', en: 'Mohandessin' },
  'zamalek': { id: 'zamalek', ar: 'الزمالك', en: 'Zamalek' },
  'downtown': { id: 'downtown', ar: 'وسط البلد', en: 'Downtown' },
  '6-october': { id: '6-october', ar: '6 أكتوبر', en: '6th of October' },
  'giza': { id: 'giza', ar: 'الهرم', en: 'Haram' },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();

  const area = AREA_MAP[slug];
  if (!area) notFound();
  await connection();

  const catalog: CatalogData | null = await getPublicCatalog();
  const stores = catalog?.stores.filter(s => s.areaId === slug) ?? [];
  const products = catalog?.products.filter(p => p.areaId === slug) ?? [];
  const hasContent = stores.length > 0 || products.length > 0;

  const ar = locale === 'ar';
  const areaName = ar ? area.ar : area.en;
  const route = `/${locale}/locations/${slug}`;
  const title = ar ? `ملابس في ${areaName}` : `Clothing in ${areaName}`;
  const description = ar
    ? `ابحث عن الملابس والمحلات في ${areaName}، القاهرة. اكتشف قطع مختارة من محلات محلية.`
    : `Search clothing and stores in ${areaName}, Cairo. Discover curated pieces from local stores.`;

  const arPath = `/ar/locations/${slug}`;
  const enPath = `/en/locations/${slug}`;

  return {
    title,
    description,
    alternates: SITE_ORIGIN ? { canonical: route, ...localizedAlternates(arPath, enPath) } : undefined,
    robots: { index: shouldIndexPage(catalog, hasContent), follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      locale: ar ? 'ar_EG' : 'en_US',
      ...(SITE_ORIGIN ? { url: new URL(route, `${SITE_ORIGIN}/`).toString() } : {}),
    },
  };
}

export default async function LocationPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();

  const area = AREA_MAP[slug];
  if (!area) notFound();
  await connection();

  const catalog = await getPublicCatalog();
  const ar = locale === 'ar';
  const areaName = ar ? area.ar : area.en;

  const stores = catalog?.stores.filter(s => s.areaId === slug) ?? [];
  const products = catalog?.products.filter(p => p.areaId === slug) ?? [];
  const hasContent = stores.length > 0 || products.length > 0;
  const websiteUrl = absoluteSiteUrl(homePath(locale));
  const arPath = `/ar/locations/${slug}`;
  const enPath = `/en/locations/${slug}`;

  const breadcrumbSchema = canIndexSite() && catalog?.source === 'database' && hasContent && websiteUrl && SITE_ORIGIN
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: ar ? 'الرئيسية' : 'Home', item: websiteUrl },
          { '@type': 'ListItem', position: 2, name: ar ? areaName : areaName, item: `${SITE_ORIGIN}${ar ? arPath : enPath}` },
        ],
      }
    : null;

  const collectionSchema = canIndexSite() && catalog?.source === 'database' && hasContent && websiteUrl && SITE_ORIGIN
    ? {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: ar ? `ملابس في ${areaName}` : `Clothing in ${areaName}`,
        description: ar
          ? `اكتشف ${stores.length} محل ملابس و${products.length} قطعة منتجة في ${areaName}.`
          : `Discover ${stores.length} clothing stores and ${products.length} products in ${areaName}.`,
        url: `${SITE_ORIGIN}${ar ? arPath : enPath}`,
      }
    : null;

  return (
    <>
      {breadcrumbSchema && <JsonLd data={breadcrumbSchema} />}
      {collectionSchema && <JsonLd data={collectionSchema} />}
      <div dir={ar ? 'rtl' : 'ltr'} className="cc-location-page">
        <header className="cc-location-header">
          <PageBrand locale={locale === 'ar' ? 'ar' : 'en'} />
          <h1>{ar ? `ملابس في ${areaName}` : `Clothing in ${areaName}`}</h1>
          <p className="cc-location-description">
            {ar
              ? `اكتشف ${stores.length} محل ملابس و${products.length} قطعة منتجة في ${areaName}.`
              : `Discover ${stores.length} clothing stores and ${products.length} products in ${areaName}.`}
          </p>
        </header>

        {catalog?.source === 'demo' && (
          <p className="cc-demo-notice">{ar ? 'نسخة تجريبية.' : 'Demo version.'}</p>
        )}

        {stores.length > 0 ? (
          <section className="cc-stores-grid" aria-labelledby="stores-heading">
            <h2 id="stores-heading">{ar ? 'المحلات' : 'Stores'}</h2>
            <ul>
              {stores.map(store => (
                <li key={store.id} className="cc-store-card">
                  <a href={`/${locale}/stores/${store.slug}`}>
                    <CatalogImage image={store.image} width={300} height={225} alt={ar ? store.ar : store.en} />
                    <h3>{ar ? store.ar : store.en}</h3>
                    <p className="cc-store-address">
                      {ar ? store.addressAr : store.addressEn}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="cc-empty-state">
            {ar ? 'لا توجد محلات في هذه المنطقة حالياً.' : 'No stores found in this area yet.'}
          </p>
        )}

        {products.length > 0 && (
          <section className="cc-products-grid" aria-labelledby="products-heading">
            <h2 id="products-heading">{ar ? 'منتجات مختارة' : 'Featured products'}</h2>
            <ul>
              {products.slice(0, 12).map(product => (
                <li key={product.id} className="cc-product-card">
                  <a href={`/${locale}/products/${product.id}`}>
                    <CatalogImage image={product.image} width={300} height={225} alt={ar ? product.ar : product.en} />
                    <h3>{ar ? product.ar : product.en}</h3>
                    <p className="cc-product-price">
                      {product.discountPercent ? (
                        <>
                          <del>{product.price} EGP</del>
                          <strong>{Math.round(product.price * (1 - product.discountPercent / 100))} EGP</strong>
                        </>
                      ) : (
                        `${product.price} EGP`
                      )}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
