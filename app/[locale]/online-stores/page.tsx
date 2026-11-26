import { notFound } from 'next/navigation';
import { OnlineStoresPreview } from '@/components/OnlineStoresPreview';

export const metadata = { robots: { index: false, follow: false } };

export default async function OnlineStoresPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ shop?: string }>;
}) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  const { shop } = await searchParams;
  return <OnlineStoresPreview locale={locale} shopId={shop} />;
}
