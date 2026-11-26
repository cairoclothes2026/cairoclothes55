'use client';

import { storeContactNumber } from '@/lib/whatsapp';
import { PageBrand } from '@/components/PageBrand';

import { EmailPreference } from './EmailPreference';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Eye, EyeOff } from 'lucide-react';
import { areas, type Locale } from '@/lib/catalog';
import { getCurrentMapLocation } from '@/lib/browser-location';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { AuthProviderButtons } from '@/components/AuthProviderButtons';
import { LegalConsentControl } from '@/components/LegalConsentControl';
import { AccountDeletion } from '@/components/AccountDeletion';
import { clearRegistrationIntent, legalRegistrationStatus, registrationContinuationPath, saveRegistrationIntent } from '@/lib/legal-registration';

type Notice = { kind: 'info' | 'error' | 'success'; text: string } | null;
type SavedApplication = { slug: string; locationSaved?: boolean };

export function StoreOnboarding({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [accountType, setAccountType] = useState<'customer' | 'merchant' | null>(null);
  const [authLoading, setAuthLoading] = useState(configured);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [contactName, setContactName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [savingApplication, setSavingApplication] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [savedApplication, setSavedApplication] = useState<SavedApplication | null>(null);
  const tx = (arabic: string, english: string) => ar ? arabic : english;

  async function detectStoreLocation() {
    setDetectingLocation(true);
    setNotice(null);
    try {
      setLocationUrl(await getCurrentMapLocation());
      setNotice({ kind: 'success', text: tx('تم تحديد الموقع. راجع الرابط ثم أرسل الطلب لحفظه.', 'Location found. Review the link, then submit the form to save it.') });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setNotice({ kind: 'error', text: code === 'location_denied'
        ? tx('لم تسمح للمتصفح بالوصول إلى الموقع. فعّل إذن الموقع أو أدخل رابط Google Maps يدويًا.', 'Location permission was denied. Allow location access or paste a Google Maps link instead.')
        : code === 'location_unsupported'
          ? tx('تحديد الموقع غير مدعوم في هذا المتصفح. أدخل رابط Google Maps يدويًا.', 'This browser does not support location detection. Paste a Google Maps link instead.')
          : tx('تعذر تحديد الموقع. تأكد من تفعيل خدمة الموقع وحاول مرة أخرى.', 'Could not detect your location. Check that location services are on and try again.') });
    } finally {
      setDetectingLocation(false);
    }
  }

  useEffect(() => {
    if (!configured) return;
    const supabase = createSupabaseBrowserClient();
    let active = true;
    const callbackFailed = new URLSearchParams(window.location.search).get('auth') === 'error';
    supabase.auth.getUser().then(async ({ data }) => {
      if (active) {
        if (data.user) {
          const status = await legalRegistrationStatus(supabase);
          if (!active) return;
          if (status.required) {
            window.location.replace(registrationContinuationPath(locale));
            return;
          }
          setAccountType(status.account_type);
        } else {
          setAccountType(null);
        }
        setUser(data.user);
        setAuthLoading(false);
        if (callbackFailed) setNotice({ kind: 'error', text: locale === 'ar' ? 'تعذر تأكيد رابط البريد. اطلب رابطًا جديدًا وحاول مرة أخرى.' : 'The email link could not be confirmed. Request a new link and try again.' });
      }
    }).catch(() => {
      if (active) {
        setAuthLoading(false);
        if (callbackFailed) setNotice({ kind: 'error', text: locale === 'ar' ? 'تعذر تأكيد رابط البريد. اطلب رابطًا جديدًا وحاول مرة أخرى.' : 'The email link could not be confirmed. Request a new link and try again.' });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setAccountType(null);
        setAuthLoading(false);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured, locale]);

  async function createPasswordAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!legalAccepted) {
      setNotice({ kind: 'error', text: tx('وافق على الشروط واطّلع على إشعار الخصوصية للمتابعة.', 'Agree to the terms and acknowledge the privacy notice to continue.') });
      return;
    }
    if (password !== confirmPassword) {
      setNotice({ kind: 'error', text: tx('كلمتا المرور غير متطابقتين.', 'Passwords do not match.') });
      return;
    }
    setSendingLink(true);
    setNotice(null);
    const intentId = await saveRegistrationIntent({ accountType: 'merchant', locale, email });
    const next = registrationContinuationPath(locale, 'merchant', intentId);
    try {
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('next', next);
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: callback.toString(), data: { full_name: contactName.trim(), account_type: 'merchant' } },
      });
      if (error) throw error;
      if (data.user?.identities?.length === 0) {
        clearRegistrationIntent(intentId);
        setNotice({ kind: 'error', text: tx('هذا البريد مسجل بالفعل. سجّل الدخول من صفحة إدارة الحساب.', 'This email is already registered. Sign in from the account page.') });
      } else if (data.session) {
        window.location.assign(next);
      } else {
        setNotice({ kind: 'success', text: tx(`أرسلنا رابط تأكيد إلى ${email.trim()}. افتحه في نفس المتصفح لإكمال الطلب.`, `We sent a confirmation link to ${email.trim()}. Open it in this browser to continue.`) });
      }
    } catch (error) {
      clearRegistrationIntent(intentId);
      const authError = error as { code?: string; status?: number; message?: string };
      const code = authError.code ?? '';
      const detail = authError.message ?? '';
      const isRateLimit = authError.status === 429 || /rate.?limit/i.test(code) || /rate.?limit/i.test(detail);
      const message = detail === 'account_type_conflict'
        ? tx('هذا البريد مسجّل لنوع حساب آخر. استخدم حسابك الحالي.', 'This email is registered for a different account type. Use your existing account.')
        : code === 'email_address_not_authorized'
        ? tx('تعذر إرسال رسالة إلى هذا البريد. تواصل مع الدعم.', 'We could not send mail to this address. Please contact support.')
        : isRateLimit
          ? tx('انتظر قليلًا قبل طلب رسالة أخرى.', 'Please wait before requesting another email.')
          : /redirect/i.test(code) || /redirect.*not allowed/i.test(detail)
            ? tx('تعذر إكمال تسجيل الدخول. تواصل مع الدعم.', 'Could not complete sign-in. Please contact support.')
            : tx('تعذر إرسال الرابط. حاول مرة أخرى.', 'Could not send the link. Please try again.');
      setNotice({ kind: 'error', text: message });
    } finally {
      setSendingLink(false);
    }
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingApplication(true);
    setNotice(null);
    const formData = new FormData(event.currentTarget);
    if (!storeContactNumber(String(formData.get('phone') ?? ''))) {
      setSavingApplication(false);
      setNotice({ kind: 'error', text: tx('أدخل رقم هاتف صحيحًا، مثل 01012345678.', 'Enter a valid phone number, for example 01012345678.') });
      return;
    }
    const payload = {
      contact_name: String(formData.get('contact_name') ?? ''),
      name_ar: String(formData.get('name_ar') ?? ''),
      name_en: String(formData.get('name_en') ?? ''),
      area_id: String(formData.get('area_id') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      address_ar: String(formData.get('address_ar') ?? ''),
      address_en: String(formData.get('address_en') ?? ''),
      location_url: String(formData.get('location_url') ?? ''),
      description_ar: String(formData.get('description_ar') ?? ''),
      description_en: String(formData.get('description_en') ?? ''),
      consent: formData.get('consent') === 'on',
    };

    try {
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string; application?: SavedApplication; locationSaved?: boolean };
      if (!response.ok || !result.application) {
        if (response.status === 401) throw new Error('authentication_required');
        if (result.error === 'invalid_area') throw new Error('invalid_area');
        if (result.error === 'account_type_conflict') throw new Error('account_type_conflict');
        throw new Error('application_not_saved');
      }
      setSavedApplication({ ...result.application, locationSaved: result.locationSaved });
      setNotice({ kind: result.locationSaved === false ? 'error' : 'success', text: result.locationSaved === false
        ? tx('تم حفظ الطلب، لكن لم يُحفظ رابط الموقع. يمكنك إضافته من لوحة المحل بعد ذلك.', 'Your application was saved, but the location link was not. You can add it later from the store dashboard.')
        : tx('تم حفظ طلبك بنجاح، وحالته الآن قيد المراجعة.', 'Your application was saved and is now pending review.') });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const text = code === 'account_type_conflict'
        ? tx('هذا الحساب مسجل كحساب متسوق. سجّل الخروج واختر «حساب محل» لإنشاء حساب منفصل.', 'This account is registered as a shopper. Sign out and choose “Store account” to create a separate account.')
        : code === 'authentication_required'
        ? tx('انتهت جلسة الدخول. أعد تسجيل الدخول بالبريد ثم أرسل الطلب.', 'Your sign-in session expired. Sign in by email again, then submit the application.')
        : code === 'invalid_area'
          ? tx('المنطقة المختارة غير متاحة. حدّث الصفحة واختر منطقة أخرى.', 'That area is unavailable. Refresh the page and choose another area.')
          : tx('تعذر حفظ الطلب الآن. تحقق من اتصالك وحاول مرة أخرى.', 'We could not save the application. Check your connection and try again.');
      setNotice({ kind: 'error', text });
    } finally {
      setSavingApplication(false);
    }
  }

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    setSavedApplication(null);
    setNotice(null);
  }

  return (
    <main className="onboarding-page" dir={ar ? 'rtl' : 'ltr'}>
      <header className="onboarding-header">
        <PageBrand locale={locale} />
        {user ? <button className="outline-btn account-sign-out" type="button" onClick={signOut}>{tx('تسجيل الخروج', 'Sign out')}</button> : <a href={`/${locale}/stores`}>{tx('تصفح دليل المحلات', 'Browse the store directory')} ↗</a>}
      </header>
      <section className="onboarding-card">
        <div className="eyebrow dark"><span/> {tx('انضم إلى دليل القاهرة', 'JOIN THE CAIRO DIRECTORY')}</div>
        <h1>{tx('خلّي محلك أقرب للاكتشاف.', 'Make your store easier to discover.')}</h1>
        <p>{tx('اعرض منتجاتك ومعلومات محلك، وساعد العملاء على اختيار وجهتهم التالية. الشراء والزيارة يظلان مباشرة من المحل.', 'Share your pieces and store details so shoppers can plan a visit. Purchases happen directly at the store.')}</p>

        {!configured ? (
          <div className="onboarding-message error" role="alert">{tx('إرسال طلبات المحلات غير متاح في النسخة التجريبية.', 'Store applications are unavailable in the demo version.')}</div>
        ) : authLoading ? (
          <p role="status">{tx('جارٍ التحقق من تسجيل الدخول…', 'Checking your sign-in…')}</p>
        ) : savedApplication ? (
          <div className="onboarding-confirmation">
            <b>{tx('وصل طلبك وهو قيد المراجعة.', 'Your application is in the review queue.')}</b>
            <span>{locale === 'ar' ? <>سنراجع بيانات المحل قبل ظهوره في دليل <span className="cc-wordmark">CAIRO CLOTHES</span>. رقم الطلب:</> : <>We will review the store details before it appears in the <span className="cc-wordmark">CAIRO CLOTHES</span> directory. Application reference:</>} <code>{savedApplication.slug}</code></span>
            {notice && <div className={`onboarding-message ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
            <a className="primary-btn" href={`/${locale}/store-dashboard`}>{tx('تابع حالة الطلب في لوحة المحل', 'Track your application in the store dashboard')}</a>
          </div>
        ) : !user ? (
          <>
            <div className="onboarding-step"><b>1</b><span>{tx('اختر طريقة إنشاء حساب المحل', 'Choose how to create your store account')}</span></div>
            <LegalConsentControl locale={locale} accountType="merchant" checked={legalAccepted} onChange={setLegalAccepted} />
            <AuthProviderButtons locale={locale} mode="register" accountType="merchant" legalConsentConfirmed={legalAccepted} />
            <div className="account-divider"><span>{tx('أو بالبريد الإلكتروني', 'OR WITH EMAIL')}</span></div>
            <form className="onboarding-form" onSubmit={createPasswordAccount}>
              <label>{tx('اسم مسؤول المحل', 'Store contact name')}<input required name="contact_name" autoComplete="name" value={contactName} onChange={(event) => setContactName(event.target.value)} maxLength={120} /></label>
              <label>{tx('البريد الإلكتروني', 'Email address')}<input required name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} /></label>
              <div className="onboarding-field">
                <label htmlFor="merchant-password-1">{tx('كلمة المرور (8 أحرف على الأقل)', 'Password (at least 8 characters)')}</label>
                <span className="auth-password-field">
                  <input id="merchant-password-1" required name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? tx('إخفاء كلمة المرور', 'Hide password') : tx('إظهار كلمة المرور', 'Show password')}>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button>
                </span>
              </div>
              <div className="onboarding-field">
                <label htmlFor="merchant-password-2">{tx('تأكيد كلمة المرور', 'Confirm password')}</label>
                <span className="auth-password-field">
                  <input id="merchant-password-2" required name="confirm_password" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? tx('إخفاء كلمة المرور', 'Hide password') : tx('إظهار كلمة المرور', 'Show password')}>{showConfirmPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button>
                </span>
              </div>
              {notice && <div className={`onboarding-message ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
              <button className="primary-btn" type="submit" disabled={sendingLink || !legalAccepted}>{sendingLink ? tx('جارٍ إنشاء الحساب وإرسال التأكيد…', 'Creating your account and sending confirmation…') : tx('إنشاء حساب المحل وإرسال رابط التأكيد', 'Create store account and send confirmation link')} ↗</button>
              <small>{tx('أنشئ كلمة مرور من 8 أحرف على الأقل. بعد تأكيد البريد، ستعود إلى هذه الصفحة لإكمال طلب المحل.', 'Create a password of at least 8 characters. After confirming your email, you will return here to finish the store application.')}</small>
            </form>
          </>
        ) : accountType === 'customer' ? (
          <div className="onboarding-message error" role="alert">{tx('هذا الحساب من نوع متسوق، ولا يمكن تحويله إلى حساب محل. سجّل الخروج ثم اختر «حساب محل» من صفحة إنشاء الحساب.', 'This is a shopper account and cannot be changed to a store account. Sign out, then choose “Store account” on the registration page.')} <button className="outline-btn account-sign-out" type="button" onClick={signOut}>{tx('تسجيل الخروج', 'Sign out')}</button></div>
        ) : accountType !== 'merchant' ? (
          <div className="onboarding-message error" role="alert">{tx('تعذر تحديد نوع الحساب. تأكد من تشغيل تحديث قاعدة البيانات ثم أعد تسجيل الدخول.', 'Could not identify the account type. Apply the database update, then sign in again.')}</div>
        ) : (
          <>
            <div className="onboarding-step"><b>2</b><span>{tx('أكمل بيانات المحل وأرسل الطلب للمراجعة', 'Complete the store details and submit your application')}</span></div>
            <p>{tx('حساب التاجر جاهز. املأ بيانات المحل واضغط «إرسال طلب الانضمام للمراجعة» ليظهر طلبك لدى مدير الموقع.', 'Your store account is ready. Enter your store details and submit the application so the site administrator can review it.')}</p>
            <form className="onboarding-form" onSubmit={submitApplication}>
              <label>{tx('اسم مسؤول المحل', 'Store contact name')}<input required name="contact_name" defaultValue={contactName || String(user.user_metadata.full_name ?? '')} maxLength={120} /></label>
              <label>{tx('اسم المحل بالعربية', 'Store name in Arabic')}<input required name="name_ar" placeholder={tx('مثال: ستايل هاوس', 'e.g. Style House')} maxLength={120} /></label>
              <label>{tx('اسم المحل بالإنجليزية', 'Store name in English')}<input required name="name_en" placeholder="Style House" maxLength={120} /></label>
              <div className="onboarding-fields">
                <label>{tx('المنطقة', 'Area')}<select required name="area_id" defaultValue=""><option value="" disabled>{tx('اختر المنطقة', 'Choose an area')}</option>{areas.map((area) => <option key={area.id} value={area.id}>{ar ? area.ar : area.en}</option>)}</select></label>
                <label>{tx('رقم الهاتف وواتساب المحل', 'Store phone and WhatsApp number')}<span className="store-contact-input" dir="ltr"><span aria-hidden="true">+2</span><input required dir="ltr" name="phone" type="tel" autoComplete="tel-national" placeholder="01012345678" maxLength={30} /></span></label>
              </div>
              <label>{tx('العنوان بالعربية', 'Address in Arabic')}<input required name="address_ar" maxLength={240} /></label>
              <label>{tx('العنوان بالإنجليزية', 'Address in English')}<input required name="address_en" maxLength={240} /></label>
              <label>{tx('الموقع LOCATION — رابط Google Maps (اختياري)', 'LOCATION — Google Maps link (optional)')}<input name="location_url" type="url" inputMode="url" placeholder="https://maps.google.com/..." maxLength={1000} value={locationUrl} onChange={(event) => setLocationUrl(event.target.value)} /><small>{tx('يمكنك تحديد موقع الجهاز بعد الوقوف داخل المحل، أو لصق رابط خرائط Google.', 'Use location detection while at the store, or paste a Google Maps link.')}</small><button className="outline-btn" type="button" onClick={() => void detectStoreLocation()} disabled={detectingLocation}>{detectingLocation ? tx('جارٍ تحديد الموقع…', 'Finding location…') : tx('تحديد موقعي تلقائيًا', 'Detect my location')}</button></label>
              <label>{tx('وصف مختصر للمحل بالعربية (اختياري)', 'Short store description in Arabic (optional)')}<textarea name="description_ar" maxLength={500} rows={3} /></label>
              <label>{tx('وصف مختصر للمحل بالإنجليزية (اختياري)', 'Short store description in English (optional)')}<textarea name="description_en" maxLength={500} rows={3} /></label>
              <label className="onboarding-consent"><input required type="checkbox" name="consent" />{tx('أؤكد أنني مخوّل بإرسال بيانات هذا المحل، وأوافق على استخدامها لمراجعة طلب الانضمام.', 'I am authorized to submit these store details and agree they may be used to review this application.')}</label>
              {notice && <div className={`onboarding-message ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
              <button className="primary-btn" type="submit" disabled={savingApplication}>{savingApplication ? tx('جارٍ حفظ الطلب…', 'Saving application…') : tx('إرسال طلب الانضمام للمراجعة', 'Submit application for review')} ↗</button>
              <small>{tx('لن يظهر المحل للعامة حتى تتم مراجعته واعتماده.', 'The store will not be visible publicly until it has been reviewed and approved.')}</small>
            </form>
            <EmailPreference locale={locale}/><div className="account-link-settings"><h2>{tx('ربط حساب اجتماعي', 'Connect a social account')}</h2><p>{tx('استخدم حسابًا مرتبطًا لتسجيل الدخول مستقبلًا إلى مساحة المحل.', 'Use a connected account to sign in to your store space next time.')}</p><AuthProviderButtons locale={locale} mode="link" redirectPath={`/${locale}/join-store`} connectedProviders={(user.identities ?? []).map((identity) => identity.provider)}/></div>
          </>
        )}
      </section>
      {user && accountType === 'merchant' && !authLoading && <AccountDeletion locale={locale} accountType="merchant" />}
      <footer className="onboarding-footer">{tx('CAIRO CLOTHES · اكتشف محليًا، اختر بثقة.', 'CAIRO CLOTHES · DISCOVER LOCAL. CHOOSE WELL.')}</footer>
    </main>
  );
}
