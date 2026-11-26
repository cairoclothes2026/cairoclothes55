import { notFound } from 'next/navigation';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';
import { LEGAL_DOCUMENTS, legalUrl } from '@/lib/legal';
import { localizedAlternates, SITE_ORIGIN } from '@/lib/site-seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  const doc = LEGAL_DOCUMENTS['merchant-agreement'];
  return {
    title: doc.title[locale],
    description: doc.intro[locale],
    alternates: SITE_ORIGIN ? {
      canonical: legalUrl(locale, 'merchant-agreement'),
      ...localizedAlternates('/ar/merchant-agreement', '/en/merchant-agreement'),
    } : undefined,
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  return <LegalDocumentPage locale={locale} documentId="merchant-agreement" />;
}
