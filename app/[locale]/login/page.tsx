import { notFound } from 'next/navigation';
import { AccountPortal } from '@/components/AccountPortal';
import type { Locale } from '@/lib/catalog';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  return <AccountPortal locale={locale as Locale} mode="login" />;
}
