'use client';

import { ComplaintsInbox } from './ComplaintsInbox';
import { AdminSearchSettings } from './AdminSearchSettings';
import { EmailPreference } from './EmailPreference';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, LogOut, Settings, ShieldAlert, Store, Users } from 'lucide-react';
import type { Locale } from '@/lib/catalog';
import { ShopperAdminPanel } from '@/components/ShopperAdminPanel';
import { StoreAdminPanel } from '@/components/StoreAdminPanel';
import { LegalAdminPanel } from '@/components/LegalAdminPanel';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { PageBrand } from '@/components/PageBrand';

type Access = 'checking' | 'not-configured' | 'signed-out' | 'denied' | 'admin';
type Notice = { kind: 'info' | 'error' | 'success'; text: string } | null;
type AdminView = 'search' | 'complaints' | 'stores' | 'shoppers' | 'customer' | 'merchant' | 'privacy';

function translate(locale: Locale, arabic: string, english: string) {
  return locale === 'ar' ? arabic : english;
}
export function AdminReview({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const configured = isSupabaseConfigured();
  const [access, setAccess] = useState<Access>(() => configured ? 'checking' : 'not-configured');
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [view, setView] = useState<AdminView>('stores');
   const [notice, setNotice] = useState<Notice>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const tx = (arabic: string, english: string) => ar ? arabic : english;
  const sections: Record<AdminView, string> = {
    search: tx('إعدادات البحث', 'Search settings'),
    stores: tx('حسابات المحلات', 'Store accounts'),
    complaints: tx('الرسائل والشكاوى', 'Messages and complaints'),
    shoppers: tx('حسابات المتسوقين', 'Shopper accounts'),
    customer: tx('موافقات المتسوقين', 'Shopper acceptances'),
    merchant: tx('موافقات المحلات', 'Store acceptances'),
    privacy: tx('سجل إشعار الخصوصية', 'Privacy acknowledgement history'),
  };
  const section = sections[view];
  useEffect(() => {
    if (!configured) return;
    let active = true;
    async function checkAccess() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error || !user) {
          setAccess('signed-out');
          return;
        }
        setUserId(user.id);
        setUserEmail(user.email ?? '');
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (active) setAccess(!profileError && profile?.role === 'admin' ? 'admin' : 'denied');
      } catch {
        if (active) setAccess('signed-out');
      }
    }
    void checkAccess();
    return () => { active = false; };
  }, [configured]);

  async function requestAdminLink(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSendingLink(true);
    setNotice(null);
    try {
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('next', `/${locale}/admin`);
      const { error } = await createSupabaseBrowserClient().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callback.toString(), shouldCreateUser: false },
      });
      if (error) throw error;
      setNotice({ kind: 'success', text: translate(locale, 'إذا كان البريد مرتبطًا بحساب مدير، أرسلنا إليه رابط الدخول. افتحه في هذا المتصفح.', 'If this email belongs to an administrator, a sign-in link has been sent. Open it in this browser.') });
    } catch (error) {
      const authError = error as { code?: string; status?: number; message?: string };
      const code = authError.code ?? '';
      const detail = authError.message ?? '';
      const isRateLimit = authError.status === 429 || /rate.?limit/i.test(code) || /rate.?limit/i.test(detail);
      const message = code === 'email_address_not_authorized'
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

  async function signInAdminWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendingLink(true);
    setNotice(null);
    try {
      const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      window.location.reload();
    } catch {
      setNotice({ kind: 'error', text: tx('اسم الحساب أو كلمة المرور غير صحيحة. إذا لم تعيّن كلمة مرور، استخدم رابط الدخول بالبريد.', 'Account name/email or password is incorrect. If you have not set a password, use the email sign-in link.') });
    } finally {
      setSendingLink(false);
    }
  }

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    setAccess('signed-out');
    setUserId('');
    setUserEmail('');
    setView('stores');
    setNotice(null);
  }

  async function saveAccountPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setNotice({ kind: 'error', text: newPassword.length < 8 ? tx('كلمة المرور يجب أن تكون 8 أحرف على الأقل.', 'Password must be at least 8 characters.') : tx('كلمتا المرور غير متطابقتين.', 'Passwords do not match.') });
      return;
    }
    setPasswordBusy(true);
    setNotice(null);
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNotice({ kind: 'success', text: tx('تم حفظ كلمة مرور حساب المدير.', 'Administrator password saved.') });
      setNewPassword('');
      setConfirmPassword('');
      setAccountSettingsOpen(false);
    } catch {
      setNotice({ kind: 'error', text: tx('تعذر حفظ كلمة المرور. حاول مرة أخرى.', 'Could not save the password. Try again.') });
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <main className="admin-shell" dir={ar ? 'rtl' : 'ltr'}>
      <aside className="admin-sidebar">
        <PageBrand locale={locale} subtitle={tx('إدارة المنصة', 'ADMINISTRATION')} />
        <div className="admin-user"><div className="admin-avatar">CC</div><div><b>{userEmail || <span className="cc-wordmark">CAIRO CLOTHES</span>}</b><small>{tx('مراجعة طلبات المحلات', 'Store application review')}</small></div></div>
        <div className="side-label">{tx('إدارة المنصة', 'PLATFORM')}</div>
        {access === 'admin' && <nav className="admin-section-nav" aria-label={tx('أقسام الإدارة', 'Administration sections')}>
          <button type="button" className={view === 'stores' ? 'side-link current' : 'side-link'} aria-pressed={view === 'stores'} onClick={() => setView('stores')}><Store size={17} />{tx('إدارة المحلات', 'Manage stores')}</button>
          <button type="button" className={view === 'complaints' ? 'side-link current' : 'side-link'} aria-pressed={view === 'complaints'} onClick={() => setView('complaints')}>{sections.complaints}</button>
          <button type="button" className={view === 'shoppers' ? 'side-link current' : 'side-link'} aria-pressed={view === 'shoppers'} onClick={() => setView('shoppers')}><Users size={17} />{tx('إدارة المتسوقين', 'Manage shoppers')}</button>
          {(['merchant', 'customer', 'privacy', 'search'] as const).map((item) => <button key={item} type="button" className={view === item ? 'side-link current' : 'side-link'} aria-pressed={view === item} onClick={() => setView(item)}>{sections[item]}</button>)}
        </nav>}
         <a className="side-link" href={`/${locale}`}>{tx('العودة إلى الموقع', 'Back to the website')}</a>
      </aside>
      <section className="admin-main">
        <header className="dash-header">
          <span><i className="status-dot"/> {tx('الإدارة', 'ADMINISTRATION')} <span className="slash">/</span> {access === 'admin' ? section : tx('دخول المدير', 'Admin sign-in')}</span>
          <div className="admin-header-actions">
            {userEmail && <span className="admin-email">{userEmail}</span>}
            {access === 'admin' && <button className="outline-btn" type="button" onClick={() => { setNotice(null); setAccountSettingsOpen(true); }}><Settings size={14}/>{tx('إعدادات الحساب', 'Account settings')}</button>}
            {access === 'admin' && <button className="outline-btn account-sign-out" type="button" onClick={signOut} aria-label={tx('تسجيل الخروج', 'Sign out')}><LogOut size={17}/>{tx('تسجيل الخروج', 'Sign out')}</button>}
          </div>
        </header>
        <div className="dash-content">
          <div className="eyebrow dark"><span/> {tx('مراجعة آمنة', 'SECURE REVIEW')}</div>
          <div className="dash-title-row"><div>
            <h1>{access === 'admin' ? section : tx('لوحة مدير الموقع', 'Site administration')}</h1>
            <p>{tx('إدارة حسابات المنصة ومراجعة طلبات المحلات.', 'Manage platform accounts and review store applications.')}</p>
          </div></div>

          {access === 'checking' && <p className="admin-state" role="status">{tx('جارٍ التحقق من صلاحية الحساب…', 'Checking account access…')}</p>}
          {access === 'not-configured' && <p className="admin-state is-error" role="alert">{tx('لوحة الإدارة غير متاحة في النسخة التجريبية.', 'Admin review is unavailable in the demo version.')}</p>}
          {access === 'signed-out' && (
            <section className="admin-auth-card">
              <ShieldAlert size={22}/>
              <h2>{tx('دخول مديري المنصة', 'Platform administrator sign-in')}</h2>
              <p>{tx('استخدم بريد حساب مدير موجود. لا يمكن إنشاء حساب مدير من هذه الصفحة.', 'Use an existing administrator account. This page cannot create administrator accounts.')}</p>
              <form className="admin-auth-form onboarding-form" onSubmit={signInAdminWithPassword}>
                <label>{tx('اسم الحساب أو البريد الإلكتروني', 'Account name or email')}<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254}/></label>
                <label>{tx('كلمة المرور', 'Password')}<span className="auth-password-field"><input required type={showLoginPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/><button type="button" className="auth-password-toggle" onClick={() => setShowLoginPassword((value) => !value)} aria-label={showLoginPassword ? tx('إخفاء كلمة المرور', 'Hide password') : tx('إظهار كلمة المرور', 'Show password')}>{showLoginPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
                {notice && <p className={`admin-state ${notice.kind === 'error' ? 'is-error' : 'is-success'}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
                <button className="primary-btn" type="submit" disabled={sendingLink}>{sendingLink ? tx('جارٍ تسجيل الدخول…', 'Signing in…') : tx('تسجيل الدخول', 'Sign in')}</button>
                <button className="onboarding-text-button" type="button" disabled={sendingLink || !email.trim()} onClick={() => void requestAdminLink()}>{tx('الدخول برابط البريد للحسابات التي لا تملك كلمة مرور', 'Email sign-in link for accounts without a password')}</button>
              </form>
            </section>
          )}
          {access === 'denied' && (
            <section className="admin-auth-card is-error">
              <ShieldAlert size={22}/>
              <h2>{tx('لا يملك هذا الحساب صلاحية الإدارة', 'This account is not an administrator')}</h2>
              <p>{tx('تواصل مع مسؤول الموقع لطلب الوصول.', 'Contact the site administrator to request access.')}</p>
              <button className="outline-btn" type="button" onClick={signOut}>{tx('استخدام حساب آخر', 'Use another account')}</button>
            </section>
          )}

          {access === 'admin' && (
            <>
              {notice && !accountSettingsOpen && <p className={`admin-state ${notice.kind === 'error' ? 'is-error' : notice.kind === 'success' ? 'is-success' : ''}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
              {view === 'stores' && <StoreAdminPanel locale={locale} userId={userId} />}
              {view === 'shoppers' && <ShopperAdminPanel locale={locale} />}
              {view === 'complaints' && <ComplaintsInbox locale={locale} />}
              {view === 'search' && <AdminSearchSettings locale={locale} />}
              {(view === 'merchant' || view === 'customer' || view === 'privacy') && <LegalAdminPanel key={view} locale={locale} view={view} />}
            </>
          )}
         </div>
      </section>
      {accountSettingsOpen && <div className="modal-backdrop" onClick={() => { if (!passwordBusy) setAccountSettingsOpen(false); }}><form className="product-modal merchant-product-form account-password-form onboarding-form" onSubmit={saveAccountPassword} onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" aria-label={tx('إغلاق', 'Close')} onClick={() => setAccountSettingsOpen(false)}>×</button><div className="eyebrow dark"><span/> {tx('إعدادات الحساب', 'ACCOUNT SETTINGS')}</div><EmailPreference locale={locale}/><h2>{tx('إضافة أو تغيير كلمة المرور', 'Add or change password')}</h2><p>{tx('أدخل كلمة مرور من 8 أحرف على الأقل لتسجيل الدخول إلى حساب المدير.', 'Set a password of at least 8 characters for your administrator account.')}</p><label>{tx('كلمة المرور الجديدة', 'New password')}<span className="auth-password-field"><input required type={showNewPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/><button type="button" className="auth-password-toggle" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? tx('إخفاء كلمة المرور', 'Hide password') : tx('إظهار كلمة المرور', 'Show password')}>{showNewPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label><label>{tx('تأكيد كلمة المرور', 'Confirm password')}<span className="auth-password-field"><input required type={showConfirmPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/><button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? tx('إخفاء كلمة المرور', 'Hide password') : tx('إظهار كلمة المرور', 'Show password')}>{showConfirmPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>{notice && <div className={`onboarding-message ${notice.kind}`} role="alert">{notice.text}</div>}<button className="primary-btn" type="submit" disabled={passwordBusy}>{passwordBusy ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ كلمة المرور', 'Save password')}</button></form></div>}
    </main>
  );
}
