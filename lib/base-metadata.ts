import type { Metadata } from 'next';
import { SITE_ORIGIN } from '@/lib/site-seo';

export function siteIcon(locale: string) {
  return locale === 'en' ? '/cairo-icon-navy.png' : '/cairo-brand-ar.png';
}

export function baseMetadata(locale: string): Metadata {
  return {
    metadataBase: SITE_ORIGIN ? new URL(SITE_ORIGIN) : undefined,
    title: {
      default: 'CAIRO CLOTHES — Fashion for Everyone',
      template: '%s | CAIRO CLOTHES',
    },
    description: 'Discover local fashion, compare pieces, and find your store.',
    applicationName: 'CAIRO CLOTHES',
    icons: { icon: { url: siteIcon(locale), type: 'image/png', sizes: '384x384' }, apple: siteIcon(locale) },
    openGraph: {
      type: 'website',
      siteName: 'CAIRO CLOTHES',
      title: 'CAIRO CLOTHES — Fashion for Everyone',
      description: 'Discover local fashion, compare pieces, and find your store.',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@CairoClothes',
      creator: '@CairoClothes',
    },
    robots: { index: true, follow: true },
  };
}
