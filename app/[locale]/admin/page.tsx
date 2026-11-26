import { notFound } from 'next/navigation';
import { AdminReview } from '@/components/AdminReview';
import type { Locale } from '@/lib/catalog';

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  return <AdminReview locale={locale as Locale} />;
}
