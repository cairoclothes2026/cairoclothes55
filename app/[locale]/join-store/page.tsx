import { notFound } from 'next/navigation';
import { StoreOnboarding } from '@/components/StoreOnboarding';
import type { Locale } from '@/lib/catalog';

export default async function JoinStorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  return <StoreOnboarding locale={locale as Locale} />;
}
