import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/site-seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/'],
    },
    ...(SITE_ORIGIN ? { sitemap: `${SITE_ORIGIN}/sitemap.xml` } : {}),
  };
}
