import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { homePath } from '@/lib/home-path';
import { getPublicCatalog } from '@/lib/catalog-server';
import { absoluteSiteUrl, canIndexHome, canIndexSite } from '@/lib/site-seo';

const AREA_SLUGS = ['nasr-city', 'new-cairo', 'heliopolis', 'maadi', 'mohandessin', 'zamalek', 'downtown', '6-october', 'giza'] as const;
const CATEGORIES = ['women', 'men', 'kids'] as const;

function localizedEntry(arPath: string, enPath: string, lastModified?: string): MetadataRoute.Sitemap[number][] {
  const arUrl = absoluteSiteUrl(arPath);
  const enUrl = absoluteSiteUrl(enPath);
  if (!arUrl || !enUrl) return [];
  const languages = { ar: arUrl, en: enUrl, 'x-default': arUrl };
  const entries: MetadataRoute.Sitemap[number][] = [
    { url: arUrl, alternates: { languages }, lastModified },
    { url: enUrl, alternates: { languages }, lastModified },
  ];
  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  if (!canIndexHome()) return [];
  const catalog = await getPublicCatalog();

  // Always include homepage for production origin
  const entries: MetadataRoute.Sitemap = [
    ...localizedEntry(homePath('ar'), homePath('en')),
    ...localizedEntry('/ar/about', '/en/about'),
  ];

  // If we have real database content, include all dynamic routes
  if (canIndexSite() && catalog?.source === 'database') {
    if (catalog.stores.length > 0) entries.push(...localizedEntry('/ar/stores', '/en/stores'));

    for (const store of catalog.stores) {
      const path = (locale: 'ar' | 'en') => `/${locale}/stores/${encodeURIComponent(store.slug)}`;
      entries.push(...localizedEntry(path('ar'), path('en')));
    }

    for (const product of catalog.products) {
      const path = (locale: 'ar' | 'en') => `/${locale}/products/${encodeURIComponent(product.id)}`;
      entries.push(...localizedEntry(path('ar'), path('en')));
    }

    // Only include category pages with published products
    for (const category of CATEGORIES) {
      const productsInCategory = catalog.products.filter(p => p.category === category);
      if (productsInCategory.length > 0) {
        entries.push(...localizedEntry(`/ar/${category}`, `/en/${category}`));
      }
    }

    // Only include location pages with stores or products
    for (const areaSlug of AREA_SLUGS) {
      const storesInArea = catalog.stores.filter(s => s.areaId === areaSlug);
      const productsInArea = catalog.products.filter(p => p.areaId === areaSlug);
      if (storesInArea.length > 0 || productsInArea.length > 0) {
        entries.push(...localizedEntry(`/ar/locations/${areaSlug}`, `/en/locations/${areaSlug}`));
      }
    }
  }

  return entries;
}