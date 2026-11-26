import { notFound } from 'next/navigation';
import { AuthContinuation } from '@/components/AuthContinuation';
import { SOCIAL_AUTH_PROVIDERS } from '@/lib/auth-providers';
import type { Locale } from '@/lib/catalog';

export default async function AuthContinuePage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ emailOtp?: string; googleOtp?: string; accountType?: string; auth?: string; legalIntent?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (locale !== 'ar' && locale !== 'en') notFound();
  const requestedAccountType = query.accountType === 'merchant' || query.accountType === 'customer' ? query.accountType : undefined;
  const providerId = query.emailOtp ?? (query.googleOtp === '1' ? 'google' : undefined);
  const emailOtpProvider = SOCIAL_AUTH_PROVIDERS.find((provider) =>
    provider.id === providerId && provider.emailOtpOnSignupFor?.includes(requestedAccountType ?? 'customer'),
  )?.id;
  return <AuthContinuation locale={locale as Locale} emailOtpProvider={emailOtpProvider} requestedAccountType={requestedAccountType} callbackFailed={query.auth === 'error'} intentId={typeof query.legalIntent === 'string' ? query.legalIntent : undefined} />;
}
