import type { CatalogData } from '@/lib/catalog';

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

function readSiteOrigin() {
  if (!configuredSiteUrl) return undefined;
  try {
    const url = new URL(configuredSiteUrl);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export const SITE_ORIGIN = readSiteOrigin();

export function absoluteSiteUrl(path: string) {
  return SITE_ORIGIN ? new URL(path.replace(/^\//, ''), `${SITE_ORIGIN}/`).toString() : undefined;
}

export function canIndexHome() {
  return Boolean(process.env.NODE_ENV === 'production'
    && SITE_ORIGIN === 'https://cairoclothes.com');
}

export function canIndexSite() {
  const hasPublicDatabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return canIndexHome() && hasPublicDatabase;
}

export function localizedAlternates(arPath: string, enPath: string) {
  return {
    languages: {
      ar: arPath,
      en: enPath,
      'x-default': arPath,
    },
  };
}

export function safeJsonLd(value: unknown) {
  return (JSON.stringify(value) ?? 'null').replace(/</g, '\\u003c');
}

/**
 * Whether a page should be indexable. A page is only indexable when the production
 * origin is valid, the public catalog was successfully loaded from the database,
 * and the page has useful published content. Otherwise it should be noindex,follow.
 */
export function shouldIndexPage(catalog: CatalogData | null | undefined, hasContent: boolean): boolean {
  return canIndexSite() && catalog?.source === 'database' && hasContent;
}
