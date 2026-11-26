import { notFound } from 'next/navigation';
import { EmailPreference } from '@/components/EmailPreference';
import { PageBrand } from '@/components/PageBrand';

export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function Unsubscribe({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  const { token } = await searchParams;
  const ar = locale === 'ar';
  return <main className="onboarding-page" lang={locale} dir={ar ? 'rtl' : 'ltr'}>
    <header className="onboarding-header"><PageBrand locale={locale} /></header>
    <section className="onboarding-card">
      <h1>{ar ? 'تفضيلات البريد' : 'Email preferences'}</h1>
      {typeof token === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(token) ?
        <EmailPreference locale={locale} token={token} /> : <p>{ar ? 'افتح الرابط الخاص الموجود في رسالتك أو استخدم إعدادات حسابك.' : 'Open the personal link in your email or use your account settings.'}</p>}
    </section>
  </main>;
}
