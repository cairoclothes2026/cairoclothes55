import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Discovery } from '@/components/Discovery';
import { siteIcon } from '@/lib/base-metadata';
import { JsonLd } from '@/components/JsonLd';
import type { CatalogData, Locale } from '@/lib/catalog';
import { getPublicCatalog } from '@/lib/catalog-server';
import { homePath } from '@/lib/home-path';
import { absoluteSiteUrl, canIndexHome, localizedAlternates, SITE_ORIGIN } from '@/lib/site-seo';

const brand = 'CAIRO CLOTHES';
const arabicBrandNames = ['كايرو كلوثز', 'كايرو كلوثس'];
const homeCopy = {
  ar: {
    title: 'CAIRO CLOTHES | دليل محلات الملابس في القاهرة',
    description: 'كايرو كلوثز دليل لاكتشاف محلات الملابس في القاهرة. تصفّح المنتجات، قارن الأسعار والمقاسات، واعرف عنوان المحل قبل زيارته.',
    language: 'ar-EG',
    ogLocale: 'ar_EG',
  },
  en: {
    title: 'CAIRO CLOTHES | Clothing Stores and Local Fashion in Cairo',
    description: 'CAIRO CLOTHES is a guide to clothing stores in Cairo. Browse products from participating shops, compare prices and sizes, and find the store before you visit.',
    language: 'en-EG',
    ogLocale: 'en_EG',
  },
} as const;

export function homeMetadata(locale: Locale): Metadata {
  const copy = homeCopy[locale];
  const route = homePath(locale);
  return {
    title: { absolute: copy.title },
    description: copy.description,
    openGraph: {
      type: 'website',
      siteName: brand,
      locale: copy.ogLocale,
      title: copy.title,
      description: copy.description,
      url: absoluteSiteUrl(route),
    },
    alternates: SITE_ORIGIN
      ? { canonical: route, ...localizedAlternates(homePath('ar'), homePath('en')) }
      : undefined,
    robots: { index: canIndexHome(), follow: true },
  };
}

function homeSchema(locale: Locale, catalog: CatalogData | null) {
  const siteUrl = absoluteSiteUrl('/');
  const pageUrl = absoluteSiteUrl(homePath(locale));
  if (!canIndexHome() || !siteUrl || !pageUrl) return null;

  const siteId = siteUrl + '#website';
  const orgId = SITE_ORIGIN + '#organization';
  const copy = homeCopy[locale];
  const featuredStores = catalog?.source === 'database' ? catalog.stores.slice(0, 6) : [];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: brand,
        alternateName: arabicBrandNames,
        url: siteUrl,
        logo: absoluteSiteUrl(siteIcon(locale)),
      },
      {
        '@type': 'WebSite',
        '@id': siteId,
        name: brand,
        alternateName: [...arabicBrandNames, 'cairoclothes.com'],
        url: siteUrl,
        inLanguage: ['ar-EG', 'en-EG'],
        publisher: { '@id': orgId },
      },
      {
        '@type': 'WebPage',
        '@id': pageUrl + '#webpage',
        url: pageUrl,
        name: copy.title,
        description: copy.description,
        inLanguage: copy.language,
        isPartOf: { '@id': siteId },
      },
      ...(featuredStores.length ? [{
        '@type': 'ItemList',
        name: locale === 'ar' ? 'محلات مقترحة' : 'Featured stores',
        itemListElement: featuredStores.map((store, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'ClothingStore',
            name: store[locale],
            url: absoluteSiteUrl('/' + locale + '/stores/' + encodeURIComponent(store.slug)),
          },
        })),
      }] : []),
    ],
  };
}

export async function HomePage({ locale }: { locale: Locale }) {
  await connection();
  const catalog = await getPublicCatalog();
  const schema = homeSchema(locale, catalog);

  return (
    <>
      {schema && <JsonLd data={schema} />}
      <Discovery locale={locale} initialCatalog={catalog} />
    </>
  );
}
