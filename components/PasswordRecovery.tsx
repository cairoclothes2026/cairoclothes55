'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { PageBrand } from './PageBrand';
import type { Locale } from '@/lib/catalog';
import { createSupabaseBrowserClient } from '@/lib/supabase';

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function PasswordRecovery({locale, mode, accountId}: {locale: Locale; accountId?: string; mode: 'request' | 'reset' | 'invalid'}) {
  const t = (ar: string, en: string) => locale === 'ar' ? ar : en;
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    try {
      const { auth } = createSupabaseBrowserClient();
      if (mode === 'request') {
        const callback = new URL('/auth/callback', window.location.origin);
        callback.searchParams.set('next', '/' + locale + '/reset-password');
        const result = await auth.resetPasswordForEmail(String(fields.get('email')).trim(), {redirectTo: callback.href});
        if (result.error) throw result.error;
      } else if (mode === 'reset') {
        const { data: {user} } = await auth.getUser();
        if (!accountId || user?.id !== accountId) throw new Error('session_changed');
        const password = String(fields.get('password'));
        if (password !== fields.get('confirm')) {
          setError(t('كلمتا المرور غير متطابقتين.', 'Passwords do not match.'));
          return;
        }
        const result = await auth.updateUser({ password });
        if (result.error) throw result.error;
        await auth.signOut({scope: 'local'});
      }
      setDone(true);
    } catch {
      setError(t('تعذّر إكمال الطلب. حاول مجددًا بعد قليل.', 'Could not complete the request. Please try again shortly.'));
    } finally { setBusy(false); }
  }
  return <main className="onboarding-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <header className="onboarding-header"><PageBrand locale={locale}/></header>
    <section className="onboarding-card account-portal-card">
      <h1>{t('إعادة تعيين كلمة المرور', 'Reset your password')}</h1>
      {mode === 'invalid' ? <p>{t('الرابط غير صالح أو انتهت صلاحيته.', 'This link is invalid or expired.')} <a href={`/${locale}/forgot-password`}>{t('اطلب رابطًا جديدًا', 'Request a new link')}</a></p>
      : done ? <p role="status">{mode === 'request' ? t('إذا كان البريد مسجلًا، سيصلك رابط لإعادة تعيين كلمة المرور. افتحه في المتصفح الذي طلبت منه الرابط.', 'If the address is registered, a reset link will arrive by email. Open it in the browser where you requested it.') : t('تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.', 'Password changed. You can now sign in.')}</p>
      : <form method="post" className="onboarding-form" onSubmit={submit}>
        {mode === 'request' ? <label>{t('البريد الإلكتروني','Email')}<input disabled={!ready} required type="email" name="email" autoComplete="email" /></label>
        : <><label>{t('كلمة المرور الجديدة','New password')}<input disabled={!ready} required minLength={8} type="password" name="password" autoComplete="new-password" /></label>
          <label>{t('تأكيد كلمة المرور','Confirm password')}<input disabled={!ready} required minLength={8} type="password" name="confirm" autoComplete="new-password" /></label></>}
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="primary-btn" disabled={!ready || busy}>{mode === 'request' ? t('أرسل رابط الاستعادة','Send reset link') : t('حفظ كلمة المرور','Save password')}</button>
      </form>}
      <a href={`/${locale}/login`}>{t('العودة لتسجيل الدخول', 'Back to sign in')}</a>
    </section>
  </main>;
}
