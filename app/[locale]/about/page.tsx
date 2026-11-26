import { notFound } from 'next/navigation';
import { Brand, SiteFooter } from '@/components/home/HomeSections';
import { homePath } from '@/lib/home-path';
import { absoluteSiteUrl, canIndexHome, localizedAlternates, SITE_ORIGIN } from '@/lib/site-seo';
import '@/components/home/home.css';

type PageProps = { params: Promise<{ locale: string }> };

const copy = {
  ar: {
    title: 'عن كايرو كلوثز',
    summary: 'كايرو كلوثز (CAIRO CLOTHES) دليل للعثور على محلات الملابس في القاهرة ومقارنة المنتجات المنشورة قبل زيارة المحل.',
    shoppersTitle: 'للمتسوّقين',
    shoppers: 'ابحث باسم القطعة أو المحل أو المنطقة. افتح صفحة المنتج للمقارنة بين السعر والمقاسات، ثم راجع عنوان المحل وبيانات التواصل المتاحة. اسأل المحل عن السعر والتوفّر قبل الذهاب.',
    storesTitle: 'لأصحاب المحلات',
    stores: 'تقدر تطلب إضافة محلك للدليل. بعد قبول الطلب، يمكنك نشر بيانات المحل وتحديث المنتجات والأسعار والمقاسات المتاحة. الشراء والتواصل يتمّان مباشرةً مع المحل.',
    directory: 'تصفّح دليل المحلات',
    join: 'أضف محلك إلى الدليل',
  },
  en: {
    title: 'About CAIRO CLOTHES',
    summary: 'CAIRO CLOTHES helps you find clothing stores in Cairo and compare the products they list before visiting in person.',
    shoppersTitle: 'For shoppers',
    shoppers: 'Search by product, store, or neighbourhood. Open a product page to compare prices and sizes, then check the store’s address and available contact details. Ask the store to confirm the price and stock before you visit.',
    storesTitle: 'For store owners',
    stores: 'Apply to add your clothing store to the directory. Once approved, you can publish your store details and update product listings, prices, and sizes. Shoppers contact and buy directly from the store.',
    directory: 'Browse the store directory',
    join: 'Add your store to the directory',
  },
} as const;

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  const route = '/' + locale + '/about';
  const text = copy[locale];
  return {
    title: { absolute: locale === 'ar' ? 'عن كايرو كلوثز | CAIRO CLOTHES' : text.title },
    description: text.summary,
    alternates: SITE_ORIGIN ? { canonical: route, ...localizedAlternates('/ar/about', '/en/about') } : undefined,
    openGraph: { type: 'website' as const, siteName: 'CAIRO CLOTHES', title: text.title, description: text.summary, url: absoluteSiteUrl(route) },
    robots: { index: canIndexHome(), follow: true },
  };
}

export default async function About({ params }: PageProps) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  const ar = locale === 'ar';
  const other = ar ? 'en' : 'ar';
  const text = copy[locale];
  return (
    <div className="cc-home" lang={locale}>
      <header className="cc-header">
        <Brand locale={locale} />
        <a className="cc-lang" href={'/' + other + '/about'} lang={other} hrefLang={other}>
          {ar ? 'English' : 'العربية'}
        </a>
      </header>
      <main className="cc-discover cc-about">
        <h1>{text.title}</h1>
        <p>{text.summary}{ar && ' ويُكتب اسم الدليل أيضًا «كايرو كلوثس».'}</p>
        <section>
          <h2>{text.shoppersTitle}</h2>
          <p>{text.shoppers}</p>
          <a href={'/' + locale + '/stores'}>{text.directory}</a>
        </section>
        <section>
          <h2>{text.storesTitle}</h2>
          <p>{text.stores}</p>
          <a href={'/' + locale + '/join-store'}>{text.join}</a>
        </section>
        <a href={homePath(locale)}>{ar ? 'العودة للرئيسية' : 'Back to the homepage'}</a>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
