import { safeJsonLd } from '@/lib/site-seo';

export function JsonLd({ data }: { data: unknown }) {
  const json = safeJsonLd(data);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
