import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import '../globals.css';
import '../catalog-pages.css';
import '@/components/onboarding.css';
import '../site-views.css';
import '../legal.css';
import '../interior-brand.css';
import { baseMetadata } from '@/lib/base-metadata';
import { LegalSiteFooter } from '@/components/LegalSiteFooter';

const supportedLocales = ['ar', 'en'] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { ...baseMetadata(locale), robots: { index: false, follow: true } };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!supportedLocales.includes(locale as (typeof supportedLocales)[number])) notFound();
  const language = locale === 'en' ? 'en-u-nu-latn' : 'ar-u-nu-latn';
  return (
    <html lang={language} dir={locale === 'en' ? 'ltr' : 'rtl'}>
      <head>
        <link rel="preload" href="/fonts/Impact.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Alyamama-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body>{children}<LegalSiteFooter locale={locale as 'ar' | 'en'} /></body>
    </html>
  );
}
