'use client';

import { isAuthApiError } from '@supabase/supabase-js';
import { PageBrand } from '@/components/PageBrand';
import { LegalConsentControl } from '@/components/LegalConsentControl';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { SocialAuthProvider } from '@/lib/auth-providers';
import type { Locale } from '@/lib/catalog';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { clearRegistrationIntent, legalRegistrationStatus, readRegistrationIntent, recordLegalAcceptance, registrationContinuationPath, type LegalAccountType } from '@/lib/legal-registration';

function normalizeEmailCode(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - '٠'.charCodeAt(0)))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - '۰'.charCodeAt(0)))
    .replace(/\D/g, '')
    .slice(0, 10);
}

export function AuthContinuation({ locale, emailOtpProvider, requestedAccountType, callbackFailed, intentId }: {
  locale: Locale;
  emailOtpProvider?: SocialAuthProvider;
  requestedAccountType?: 'customer' | 'merchant';
  callbackFailed: boolean;
  intentId?: string;
}) {
  const ar = locale === 'ar';
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(Boolean(emailOtpProvider) && !callbackFailed);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'success' | 'error'>('success');
  const [legalStep, setLegalStep] = useState<{ canChooseType: boolean } | null>(null);
  const [legalAccountType, setLegalAccountType] = useState<LegalAccountType>('customer');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const autoStartRef = useRef(false);

  const tx = useCallback((arabic: string, english: string) => ar ? arabic : english, [ar]);
  const conflictMessage = tx(
    'هذا الحساب مسجّل بالفعل بنوع آخر. سجّل الدخول إلى حسابك الحالي أو استخدم حسابًا مختلفًا للتسجيل.',
    'This account is already registered as another type. Sign in to your existing account or use a different account to register.',
  );

  const continueToAccount = useCallback(async (acceptType?: LegalAccountType) => {
    const supabase = createSupabaseBrowserClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('authentication_required');
    const status = await legalRegistrationStatus(supabase);
    const intent = await readRegistrationIntent(intentId, user);
    const chosenType = acceptType ?? (requestedAccountType ?? status.account_type);
    if (status.required) {
      if (!status.can_choose_type && chosenType !== status.account_type) throw new Error('account_type_conflict');
      const trustedIntent = intent?.locale === locale && intent.accountType === chosenType;
      if (!acceptType && !trustedIntent) {
        setNotice('');
        setLegalAccountType(chosenType);
        setLegalStep({ canChooseType: status.can_choose_type && !requestedAccountType });
        return;
      }
      await recordLegalAcceptance(supabase, chosenType, locale);
    } else {
      const { error: setupError } = await supabase.rpc('complete_oauth_account_registration', {
        selected_account_type: requestedAccountType ?? null,
      });
      if (setupError) throw new Error(setupError.message === 'account_type_conflict' ? 'account_type_conflict' : 'account_type_unavailable');
    }
    clearRegistrationIntent(intentId);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role,account_type')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !profile) throw new Error('account_type_unavailable');
    const destination = profile.account_type === 'merchant' && (requestedAccountType === 'merchant' || status.required)
      ? `/${locale}/join-store`
      : profile.role === 'admin'
        ? `/${locale}/admin`
        : profile.account_type === 'merchant'
          ? `/${locale}/store-dashboard`
          : `/${locale}`;
    window.location.replace(destination);
  }, [intentId, locale, requestedAccountType]);

  const sendEmailCode = useCallback(async (address: string) => {
    setSending(true);
    setNotice('');
    try {
      // The email template is shared with other passwordless flows and may also offer a link.
      const destination = new URL(`/${locale}/auth/continue`, window.location.origin);
      if (requestedAccountType) destination.searchParams.set('accountType', requestedAccountType);
      if (intentId) destination.searchParams.set('legalIntent', intentId);
      const callback = new URL('/auth/callback', destination.origin);
      callback.searchParams.set('next', destination.pathname + destination.search);
      const { error } = await createSupabaseBrowserClient().auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
      });
      if (error) throw error;
      setCode('');
      setNoticeKind('success');
      setNotice(tx(`تحقق من ${address} وأدخل الرمز هنا. إذا لم تجد الرسالة، افحص البريد غير المرغوب فيه.`, `Check ${address} and enter the code here. If you do not see the email, check your spam folder.`));
    } catch (error) {
      setNoticeKind('error');
      if (isAuthApiError(error) && error.status === 429) {
        setNotice(tx('طلبات الإرسال متقاربة. انتظر قليلًا ثم أعد المحاولة.', 'Too many email requests. Wait a moment before trying again.'));
      } else {
        setNotice(tx('تعذر إرسال رمز البريد. أعد المحاولة أو تواصل مع دعم الموقع إذا استمرت المشكلة.', 'We could not send your email code. Try again or contact site support if the problem persists.'));
      }
    } finally {
      setSending(false);
    }
  }, [intentId, locale, requestedAccountType, tx]);

  useEffect(() => {
    if (callbackFailed) return;
    let active = true;
    async function finish() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!active || autoStartRef.current) return;
        if (error || !user) throw new Error('authentication_required');
        autoStartRef.current = true;
        if (!emailOtpProvider) {
          await continueToAccount();
          return;
        }
        const status = await legalRegistrationStatus(supabase);
        if (status.required) {
          if (requestedAccountType && !status.can_choose_type && status.account_type !== requestedAccountType) {
            throw new Error('account_type_conflict');
          }
        } else {
          const { data: profile, error: profileError } = await supabase.from('profiles')
            .select('role,account_type,account_type_locked').eq('id', user.id).maybeSingle();
          if (profileError || !profile) throw new Error('account_type_unavailable');
          if (requestedAccountType && (profile.role === 'admin'
            || (profile.account_type_locked && profile.account_type !== requestedAccountType))) {
            throw new Error('account_type_conflict');
          }
        }
        if (!user.email) throw new Error('email_unavailable');

        // The verified email code creates the session used by the app.
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
        if (signOutError) throw new Error('session_clear_failed');
        const { data: { session } } = await supabase.auth.getSession();
        if (session) throw new Error('session_clear_failed');
        if (!active) return;
        setEmail(user.email);
        await sendEmailCode(user.email);
      } catch (error) {
        if (active) {
          setNoticeKind('error');
          setNotice(error instanceof Error && error.message === 'email_unavailable'
            ? tx('لم يرسل مزود تسجيل الدخول عنوان بريد لهذا الحساب.', 'Your sign-in provider did not provide an email address for this account.')
            : error instanceof Error && error.message === 'session_clear_failed'
              ? tx('تعذر إكمال التحقق بالبريد. سجّل الخروج ثم أعد المحاولة.', 'Could not start email verification. Sign out and try again.')
              : error instanceof Error && error.message === 'account_type_conflict'
                ? conflictMessage
                : error instanceof Error && error.message.startsWith('legal_')
                  ? tx('تعذر إكمال تسجيل الموافقة. أعد المحاولة.', 'Could not complete legal acceptance. Please retry.')
                : error instanceof Error && error.message === 'account_type_unavailable'
                  ? tx('تعذر التحقق من نوع الحساب. حاول تسجيل الدخول مجددًا.', 'Could not verify the account type. Try signing in again.')
                  : tx('تعذر إكمال الدخول. سجّل الدخول مرة أخرى.', 'Could not complete sign-in. Please sign in again.'));
        }
        if (active) setSending(false);
      }
    }
    void finish();
    return () => { active = false; };
  }, [callbackFailed, conflictMessage, continueToAccount, emailOtpProvider, requestedAccountType, sendEmailCode, tx]);

  async function verifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifying(true);
    setNotice('');
    try {
      const { data: { user }, error } = await createSupabaseBrowserClient().auth.verifyOtp({ email, token: code, type: 'email' });
      if (error || !user) throw new Error('invalid_email_code');
      window.history.replaceState(window.history.state, '', registrationContinuationPath(locale, requestedAccountType, intentId));
      await continueToAccount();
    } catch (error) {
      setNoticeKind('error');
      setNotice(error instanceof Error && error.message === 'account_type_conflict'
        ? conflictMessage
        : error instanceof Error && error.message.startsWith('legal_')
          ? tx('تم التحقق من البريد. أعد تحميل الصفحة لإكمال الموافقة.', 'Your email was verified. Reload to finish accepting the terms.')
        : error instanceof Error && error.message === 'account_type_unavailable'
          ? tx('تعذر التحقق من نوع الحساب. حاول تسجيل الدخول مجددًا.', 'Could not verify the account type. Try signing in again.')
          : tx('الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.', 'The code is incorrect or expired. Request a new one.'));
    } finally {
      setVerifying(false);
    }
  }

  async function acceptTerms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!legalAccepted || verifying) return;
    setVerifying(true);
    setNotice('');
    try {
      await continueToAccount(legalAccountType);
    } catch {
      setNoticeKind('error');
      setNotice(tx('تعذر تسجيل الموافقة. أعد المحاولة.', 'Could not record your acceptance. Please retry.'));
    } finally {
      setVerifying(false);
    }
  }

  async function leaveRegistration() {
    setVerifying(true);
    const { error } = await createSupabaseBrowserClient().auth.signOut({ scope: 'local' });
    if (!error) {
      clearRegistrationIntent(intentId);
      window.location.replace(`/${locale}`);
      return;
    }
    setVerifying(false);
    setNoticeKind('error');
    setNotice(tx('تعذر تسجيل الخروج. أعد المحاولة.', 'Could not sign out. Please retry.'));
  }

  return (
    <main className="onboarding-page" dir={ar ? 'rtl' : 'ltr'} lang={locale}>
      <header className="onboarding-header"><PageBrand locale={locale} /></header>
      <section className="onboarding-card account-portal-card">
        <div className="eyebrow dark"><span/> {tx('تأكيد الحساب', 'ACCOUNT CONFIRMATION')}</div>
        {callbackFailed ? <>
          <h1>{tx('تعذر إكمال تسجيل الدخول', 'Could not complete sign-in')}</h1>
          <p className="onboarding-message error" role="alert">{tx('ابدأ محاولة جديدة من الموقع لإكمال التحقق.', 'Start a new attempt from the website to complete verification.')}</p>
          <a className="primary-btn" href={`/${locale}/${requestedAccountType ? 'register' : 'login'}`}>{tx('إعادة المحاولة', 'Try again')}</a>
        </> : legalStep ? <>
          <h1>{tx('أكمل إنشاء حسابك', 'Finish creating your account')}</h1>
          <form className="onboarding-form" onSubmit={acceptTerms}>
            {legalStep.canChooseType && <label>
              {tx('نوع الحساب', 'Account type')}
              <select value={legalAccountType} onChange={(event) => {
                setLegalAccountType(event.target.value === 'merchant' ? 'merchant' : 'customer');
                setLegalAccepted(false);
              }}>
                <option value="customer">{tx('متسوق', 'Shopper')}</option>
                <option value="merchant">{tx('محل', 'Store')}</option>
              </select>
            </label>}
            <LegalConsentControl locale={locale} accountType={legalAccountType} checked={legalAccepted} onChange={setLegalAccepted} />
            {notice && <div className="onboarding-message error" role="alert">{notice}</div>}
            <button className="primary-btn" type="submit" disabled={!legalAccepted || verifying}>{tx('إكمال التسجيل', 'Complete registration')}</button>
            <button className="outline-btn account-sign-out" type="button" disabled={verifying} onClick={() => void leaveRegistration()}>{tx('الخروج من التسجيل', 'Leave registration')}</button>
          </form>
        </> : emailOtpProvider ? <>
          <h1>{tx('أدخل رمز البريد الإلكتروني', 'Enter your email code')}</h1>
          <p>{tx('أدخل الرمز المرسل إلى البريد المرتبط بحساب تسجيل الدخول.', 'Enter the code sent to the email linked to your sign-in account.')}</p>
          {notice && <div className={`onboarding-message ${noticeKind}`} role={noticeKind === 'error' ? 'alert' : 'status'}>{notice}</div>}
          <form className="onboarding-form" onSubmit={verifyEmailCode}>
            <label>{tx('رمز التحقق', 'Verification code')}<input required inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={10} dir="ltr" value={code} onChange={(event) => setCode(normalizeEmailCode(event.target.value))} /></label>
            <button className="primary-btn sign-in-submit" type="submit" disabled={verifying || sending || !email}>{verifying ? tx('جارٍ التحقق…', 'Verifying…') : tx('تأكيد البريد والمتابعة', 'Verify email and continue')}</button>
            <button className="onboarding-text-button" type="button" disabled={sending || verifying || !email} onClick={() => void sendEmailCode(email)}>{sending ? tx('جارٍ إرسال الرمز…', 'Sending code…') : tx('إعادة إرسال الرمز', 'Resend code')}</button>
          </form>
          {!sending && !email && <a className="onboarding-text-button" href={`/${locale}/register`}>{tx('العودة إلى إنشاء حساب', 'Back to registration')}</a>}
        </> : <>
          <h1>{tx('جارٍ توجيهك إلى حسابك…', 'Taking you to your account…')}</h1>
          {notice && <><div className="onboarding-message error" role="alert">{notice}</div><a className="outline-btn" href={`/${locale}/login`}>{tx('العودة إلى تسجيل الدخول', 'Back to sign-in')}</a></>}
        </>}
      </section>
    </main>
  );
}
