import { notFound } from 'next/navigation';
import { StoreDirectory } from '@/components/StoreDirectory';
import type { Locale } from '@/lib/catalog';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getPublicCatalog } from '@/lib/catalog-server';
import { canIndexSite, localizedAlternates, SITE_ORIGIN } from '@/lib/site-seo';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  await connection();
  const catalog = await getPublicCatalog();
  const indexable = canIndexSite() && catalog?.source === 'database' && catalog.stores.length > 0;
  const route = `/${locale}/stores`;
  const ar = locale === 'ar';
  const title = ar ? 'دليل محلات الملابس في القاهرة' : 'Cairo Clothing Store Directory';
  const description = ar
    ? 'تعرّف على محلات الملابس المنشورة في القاهرة، استكشف عناوينها ومناطقها، وتواصل معها قبل الزيارة.'
    : 'Explore published clothing stores across Cairo, find their areas and locations, and contact them before you visit.';

  return {
    title,
    description,
    alternates: SITE_ORIGIN ? { canonical: route, ...localizedAlternates('/ar/stores', '/en/stores') } : undefined,
    robots: { index: indexable, follow: true },
    openGraph: { type: 'website', title, description, locale: ar ? 'ar_EG' : 'en_US', ...(SITE_ORIGIN ? { url: new URL(route, `${SITE_ORIGIN}/`).toString() } : {}) },
  };
}

export default async function Stores({ params }: PageProps) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  await connection();
  const catalog = await getPublicCatalog();
  return <StoreDirectory locale={locale as Locale} initialCatalog={catalog} />;
}
