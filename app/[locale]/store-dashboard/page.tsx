import { notFound } from 'next/navigation';
import type { Locale } from '@/lib/catalog';
import { StoreProductManager } from '@/components/StoreProductManager';
import './dashboard.css';

export default async function StoreDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  return <StoreProductManager locale={locale as Locale} />;
}
