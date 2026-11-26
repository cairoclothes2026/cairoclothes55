import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getPublicCatalog } from '@/lib/catalog-server';
import { homePath } from '@/lib/home-path';
import { absoluteSiteUrl, canIndexSite, localizedAlternates, shouldIndexPage, SITE_ORIGIN } from '@/lib/site-seo';
import { JsonLd } from '@/components/JsonLd';
import { PageBrand } from '@/components/PageBrand';
import { CategoryEmptyState } from '@/components/CategoryEmptyState';
import { CategoryProductCard } from '@/components/CategoryProductCard';
import type { CatalogData, Locale } from '@/lib/catalog';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  await connection();

  const catalog: CatalogData | null = await getPublicCatalog();
  const products = catalog?.products.filter(p => p.category === 'men') ?? [];
  const hasContent = products.length > 0;

  const ar = locale === 'ar';
  const route = `/${locale}/men`;
  const title = ar ? 'ملابس رجالية في القاهرة' : "Men's clothing in Cairo";
  const description = ar
    ? "ابحث عن ملابس رجالية من محلات القاهرة. اكتشف قطع أساسية وأزياء قبل زيارة المحل."
    : "Search men's clothing from Cairo stores. Discover essentials and fashion pieces before visiting the store.";

  return {
    title,
    description,
    alternates: SITE_ORIGIN ? { canonical: route, ...localizedAlternates(`/ar/men`, `/en/men`) } : undefined,
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

export default async function MenPage({ params }: PageProps) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  await connection();
  const catalog = await getPublicCatalog();

  const ar = locale === 'ar';
  const products = catalog?.products.filter(p => p.category === 'men') ?? [];
  const hasContent = products.length > 0;
  const websiteUrl = absoluteSiteUrl(homePath(locale));

  const breadcrumbSchema = canIndexSite() && catalog?.source === 'database' && hasContent && websiteUrl && SITE_ORIGIN
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: ar ? 'الرئيسية' : 'Home', item: websiteUrl },
          { '@type': 'ListItem', position: 2, name: ar ? 'ملابس رجالية' : "Men's clothing", item: `${SITE_ORIGIN}${ar ? '/ar/men' : '/en/men'}` },
        ],
      }
    : null;

  const collectionSchema = canIndexSite() && catalog?.source === 'database' && hasContent && websiteUrl && SITE_ORIGIN
    ? {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: ar ? 'ملابس رجالية' : "Men's clothing",
        description: ar ? 'اكتشف قطع أساسية من محلات القاهرة.' : 'Discover essentials from Cairo stores.',
        url: `${SITE_ORIGIN}${ar ? '/ar/men' : '/en/men'}`,
      }
    : null;

  return (
    <>
      {breadcrumbSchema && <JsonLd data={breadcrumbSchema} />}
      {collectionSchema && <JsonLd data={collectionSchema} />}
      <div dir={ar ? 'rtl' : 'ltr'} className="cc-category-page">
        <header className="cc-catalog-header"><PageBrand locale={locale as Locale} /></header>
        <h1>{ar ? 'ملابس رجالية' : "Men's clothing"}</h1>
        <p className="cc-category-description">
          {ar
            ? "ابحث عن ملابس رجالية من محلات القاهرة. اكتشف قطع أساسية وأزياء قبل زيارة المحل."
            : "Search men's clothing from Cairo stores. Discover essentials and fashion pieces before visiting the store."}
        </p>
        {catalog?.source === 'demo' && (
          <p className="cc-demo-notice">{ar ? 'نسخة تجريبية.' : 'Demo version.'}</p>
        )}
        <section className="cc-products-grid">
          {products.length > 0 ? (
            products.slice(0, 24).map(product => (
              <CategoryProductCard key={product.id} product={product} locale={locale as Locale} stores={catalog?.stores ?? []} areas={catalog?.areas ?? []} />
            ))
          ) : (
            <CategoryEmptyState locale={locale as Locale} />
          )}
        </section>
      </div>
    </>
  );
}
