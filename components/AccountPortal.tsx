'use client';

import { AuthProviderButtons } from '@/components/AuthProviderButtons';
import { PageBrand } from '@/components/PageBrand';
import { LegalConsentControl } from '@/components/LegalConsentControl';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Store, UserRound } from 'lucide-react';
import type { Locale } from '@/lib/catalog';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { clearRegistrationIntent, legalRegistrationStatus, registrationContinuationPath, saveRegistrationIntent } from '@/lib/legal-registration';

type Props = { locale: Locale; mode: 'login' | 'register' };
type AccountType = 'customer' | 'merchant';
type Notice = { kind: 'error' | 'success'; text: string } | null;

export function AccountPortal({ locale, mode }: Props) {
  const ar = locale === 'ar';
  const registering = mode === 'register';
  const configured = isSupabaseConfigured();
  const heading = useRef<HTMLHeadingElement>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);

  const tx = useCallback((arabic: string, english: string) => ar ? arabic : english, [ar]);

  const continueByAccountType = useCallback(async (expected?: AccountType) => {
    const supabase = createSupabaseBrowserClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('authentication_required');
    if ((await legalRegistrationStatus(supabase)).required) {
      window.location.replace(registrationContinuationPath(locale, expected));
      return;
    }
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role,account_type')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !profile) throw new Error('account_setup_required');
    if (expected && (profile.role === 'admin' || profile.account_type !== expected)) throw new Error('account_type_conflict');
    const destination = profile.role === 'admin'
      ? `/${locale}/admin`
      : profile.account_type === 'merchant'
        ? `/${locale}/store-dashboard`
        : `/${locale}`;
    window.location.assign(destination);
  }, [locale]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      try {
        await continueByAccountType();
      } catch {
        if (active) setNotice({ kind: 'error', text: tx('تعذر تحديد نوع الحساب. حدّث قاعدة البيانات ثم أعد المحاولة.', 'Could not identify the account type. Update the database, then try again.') });
      }
    });
    return () => { active = false; };
  }, [configured, continueByAccountType, tx]);

  const previousAccountType = useRef(accountType);
  useEffect(() => {
    if (previousAccountType.current !== accountType) heading.current?.focus();
    previousAccountType.current = accountType;
  }, [accountType]);

  function chooseAccountType(type: AccountType | null) {
    setAccountType(type);
    setLegalAccepted(false);
    setNotice(null);
  }

  const registrationTitle = accountType === 'customer'
    ? tx('إنشاء حساب متسوّق', 'Create a shopper account')
    : accountType === 'merchant'
      ? tx('إنشاء حساب محل', 'Create a store account')
      : tx('اختر نوع حسابك', 'Choose your account type');

  function callbackUrl(next: string) {
    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', next);
    return callback.toString();
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await continueByAccountType();
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error && ['account_setup_required', 'legal_status_unavailable'].includes(error.message)
        ? tx('تعذر تحميل حسابك. حاول مرة أخرى.', 'Could not load your account. Please try again.')
        : tx('البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'Email address or password is incorrect.') });
    } finally {
      setBusy(false);
    }
  }

  async function registerByEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!legalAccepted) {
      setNotice({ kind: 'error', text: tx('وافق على الشروط واطّلع على إشعار الخصوصية للمتابعة.', 'Agree to the terms and acknowledge the privacy notice to continue.') });
      return;
    }
    if (password.length < 8 || password !== confirmPassword) {
      setNotice({ kind: 'error', text: password.length < 8
        ? tx('كلمة المرور يجب أن تكون 8 أحرف على الأقل.', 'Password must be at least 8 characters.')
        : tx('كلمتا المرور غير متطابقتين.', 'Passwords do not match.') });
      return;
    }
    setBusy(true);
    setNotice(null);
    const intentId = await saveRegistrationIntent({ accountType: 'customer', locale, email });
    const next = registrationContinuationPath(locale, 'customer', intentId);
    try {
      const { data, error } = await createSupabaseBrowserClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: callbackUrl(next),
          data: { full_name: fullName.trim(), account_type: 'customer' },
        },
      });
      if (error) throw error;
      if (data.user?.identities?.length === 0) {
        clearRegistrationIntent(intentId);
        setNotice({ kind: 'error', text: tx('هذا البريد مسجل بالفعل. سجّل الدخول بالحساب الموجود.', 'This email is already registered. Sign in to the existing account.') });
      } else if (data.session) {
        window.location.assign(next);
      } else {
        setNotice({ kind: 'success', text: tx(`أرسلنا رسالة تأكيد إلى ${email.trim()}. افتحها لإكمال إنشاء الحساب.`, `We sent a confirmation email to ${email.trim()}. Open it to finish creating your account.`) });
      }
    } catch (error) {
      clearRegistrationIntent(intentId);
      setNotice({ kind: 'error', text: error instanceof Error && error.message === 'account_type_conflict'
        ? tx('هذا البريد مسجّل لنوع حساب آخر. استخدم حسابك الحالي.', 'This email is registered for a different account type. Use your existing account.')
        : tx('تعذر إنشاء الحساب. تحقق من البريد وكلمة المرور ثم حاول مرة أخرى.', 'Could not create the account. Check the email and password, then try again.') });
    } finally {
      setBusy(false);
    }
  }

  if (!configured) return <main className="onboarding-page" dir={ar ? 'rtl' : 'ltr'}><section className="onboarding-card"><div className="onboarding-message error">{tx('تسجيل الدخول غير متاح في النسخة التجريبية.', 'Sign-in is unavailable in the demo version.')}</div></section></main>;

  return (
    <main className="onboarding-page" dir={ar ? 'rtl' : 'ltr'} lang={locale}>
      <header className="onboarding-header"><PageBrand locale={locale} /><a href={`/${locale}/stores`}>{tx('تصفّح المحلات', 'Browse stores')}</a></header>
      <section className="onboarding-card account-portal-card">
        {!accountType && <div className="eyebrow dark">{registering ? tx('إنشاء حساب جديد', 'CREATE AN ACCOUNT') : tx('الدخول الموحد', 'ONE SIGN-IN FOR ALL ACCOUNTS')}</div>}
        <h1 ref={heading} tabIndex={-1}>{registering ? registrationTitle : tx('تسجيل الدخول', 'Sign in')}</h1>
        {registering && !accountType && <>
          <p>{tx('اختر نوع الحساب المناسب لك للمتابعة.', 'Choose the account type that suits you.')}</p>
          <div className="account-type-choices">
            <button type="button" onClick={() => chooseAccountType('customer')}><UserRound size={22} aria-hidden="true" /><b>{tx('حساب متسوّق', 'Shopper account')}</b><small>{tx('تصفّح الملابس واحفظ بياناتك الشخصية.', 'Discover clothing and save your personal details.')}</small></button>
            <button type="button" onClick={() => chooseAccountType('merchant')}><Store size={22} aria-hidden="true" /><b>{tx('حساب محل', 'Store account')}</b><small>{tx('أنشئ صفحة لمحلك وأرسلها للمراجعة.', 'Create a page for your store and submit it for review.')}</small></button>
          </div>
        </>}
        {registering && accountType === 'merchant' && <div className="account-choice-followup">
          <p>{tx('أنشئ حساب المحل بالبريد أو تابع باستخدام إحدى وسائل الدخول الاجتماعي المتاحة.', 'Create a store account with email or continue with an available social sign-in method.')}</p>
          <LegalConsentControl locale={locale} accountType="merchant" checked={legalAccepted} onChange={setLegalAccepted} />
          <AuthProviderButtons locale={locale} mode="register" accountType="merchant" legalConsentConfirmed={legalAccepted} />
          <div className="account-divider"><span>{tx('أو بالبريد الإلكتروني', 'OR WITH EMAIL')}</span></div>
          <a className="primary-btn" href={`/${locale}/join-store`}>{tx('المتابعة بالبريد الإلكتروني', 'Continue with email')} ↗</a>
          <button className="onboarding-text-button" type="button" onClick={() => chooseAccountType(null)}>{tx('العودة لاختيار نوع الحساب', 'Back to account type')}</button>
        </div>}
        {(!registering || accountType === 'customer') && <>
          {registering && <button type="button" className="onboarding-text-button account-back-button" onClick={() => chooseAccountType(null)}>{tx('تغيير نوع الحساب', 'Change account type')}</button>}
          <p>{registering ? tx('تابع باستخدام Google أو Facebook، أو سجّل ببريدك الإلكتروني واختر كلمة مرور لحسابك.', 'Continue with Google or Facebook, or register with your email and choose a password.') : tx('سجّل دخولك بالطريقة المرتبطة بحسابك. سنحوّلك تلقائيًا إلى مساحة المحل أو صفحة اكتشاف الملابس.', 'Sign in using the method connected to your account. We will direct you to your store space or clothing discovery.')}</p>
          {registering && <LegalConsentControl locale={locale} accountType="customer" checked={legalAccepted} onChange={setLegalAccepted} />}
          <AuthProviderButtons locale={locale} mode={registering ? 'register' : 'login'} accountType="customer" legalConsentConfirmed={legalAccepted} />
          <div className="account-divider"><span>{tx('أو', 'OR')}</span></div>
          {registering ? <form className="onboarding-form" onSubmit={registerByEmail}>
            <label>{tx('الاسم الشخصي', 'Your name')}<input required name="name" autoComplete="name" maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
            <label>{tx('البريد الإلكتروني', 'Email address')}<input required name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <div className="onboarding-field">
              <label htmlFor="account-password-1">{tx('كلمة المرور (8 أحرف على الأقل)', 'Password (at least 8 characters)')}</label>
              <span className="auth-password-field">
                <input id="account-password-1" required type={showPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? tx('إخفاء كلمة المرور', 'Hide password') : tx('إظهار كلمة المرور', 'Show password')}>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button>
              </span>
            </div>
            <div className="onboarding-field">
              <label htmlFor="account-password-2">{tx('تأكيد كلمة المرور', 'Confirm password')}</label>
              <span className="auth-password-field">
                <input id="account-password-2" required type={showConfirmPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? tx('إخفاء كلمة المرور', 'Hide password') : tx('إظهار كلمة المرور', 'Show password')}>{showConfirmPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button>
              </span>
            </div>
            {notice && <div className={`onboarding-message ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
            <button className="primary-btn sign-in-submit" type="submit" disabled={busy || !legalAccepted}>{busy ? tx('جارٍ إنشاء الحساب…', 'Creating account…') : tx('إنشاء حساب متسوّق', 'Create shopper account')}</button>
          </form> : <form className="onboarding-form" onSubmit={signIn}>
            <label>{tx('البريد الإلكتروني', 'Email address')}<input required name="email" type="email" autoComplete="username" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <div className="onboarding-field">
              <label htmlFor="account-password-3">{tx('كلمة المرور', 'Password')}</label>
              <span className="auth-password-field">
                <input id="account-password-3" required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? tx('إخفاء كلمة المرور', 'Hide password') : tx('إظهار كلمة المرور', 'Show password')}>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button>
              </span>
            </div>
            <a className="onboarding-text-button" href={`/${locale}/forgot-password`}>{tx('نسيت كلمة المرور؟', 'Forgot password?')}</a>
            {notice && <div className={`onboarding-message ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
            <button className="primary-btn sign-in-submit" type="submit" disabled={busy}>{busy ? tx('جارٍ تسجيل الدخول…', 'Signing in…') : tx('تسجيل الدخول', 'Sign in')}</button>
          </form>}
          {!registering && <p className="account-register-prompt">{locale === 'ar' ? 'ليس لديك حساب؟' : <>New to <span className="cc-wordmark">CAIRO CLOTHES</span>?</>} <a href={`/${locale}/register`}>{tx('حساب جديد', 'Create account')}</a></p>}
        </>}
      </section>
      <footer className="onboarding-footer"><bdi className="cc-wordmark" lang="en" dir="ltr">CAIRO CLOTHES</bdi> · {tx('اكتشف محليًا، اختر بثقة.', 'Discover local. Choose well.')}</footer>
    </main>
  );
}
