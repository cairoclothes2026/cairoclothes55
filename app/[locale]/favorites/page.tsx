import { notFound } from 'next/navigation';
import { CustomerAccount } from '@/components/CustomerAccount';
import type { Locale } from '@/lib/catalog';

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  return <CustomerAccount locale={locale as Locale} page="favorites" />;
}
