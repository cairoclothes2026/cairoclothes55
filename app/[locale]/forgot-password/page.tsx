import { notFound } from 'next/navigation';
import { PasswordRecovery } from '@/components/PasswordRecovery';

export default async function ForgotPassword({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  return <PasswordRecovery locale={locale} mode="request" />;
}
