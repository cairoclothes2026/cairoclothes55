'use client';

import { EmailPreference } from './EmailPreference';
import { useRouter } from 'next/navigation';
import { Wardrobe } from './Wardrobe';
import { SavedPieces } from '@/components/SavedPieces';
import { homePath } from '@/lib/home-path';
import { PageBrand } from '@/components/PageBrand';

import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Heart, LogOut, UserRound } from 'lucide-react';
import type { Locale } from '@/lib/catalog';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { AuthProviderButtons } from '@/components/AuthProviderButtons';
import { AccountDeletion } from '@/components/AccountDeletion';
import { legalRegistrationStatus, registrationContinuationPath } from '@/lib/legal-registration';

type AccountProfile = { id: string; full_name: string | null; account_type: string; role: string };

function subscribeToAccountSection(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function currentSection() {
  return window.location.hash;
}

function initialAccountSection() {
  return '';
}

export function CustomerAccount({ locale, page = 'account' }: { locale: Locale; page?: 'account' | 'favorites' }) {
  const router = useRouter();
  const ar = locale === 'ar';
  const configured = isSupabaseConfigured();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const section = useSyncExternalStore(subscribeToAccountSection, currentSection, initialAccountSection);
  const favoritesPage = page === 'favorites';
  const legacyFavorites = !favoritesPage && section === '#saved-pieces';
  const showWardrobe = section === '#wardrobe';
  const tx = useCallback((arabic: string, english: string) => ar ? arabic : english, [ar]);

  useEffect(() => {
    let active = true;
    if (!favoritesPage && window.location.hash === '#saved-pieces') {
      window.location.replace('/' + locale + '/favorites');
      return;
    }
    async function loadAccount() {
      if (!configured) { setLoading(false); return; }
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) { active = false; window.location.replace(`/${locale}/login`); return; }
        const legal = await legalRegistrationStatus(supabase);
        if (!active) return;
        if (legal.required) { active = false; window.location.replace(registrationContinuationPath(locale)); return; }
        const { data, error } = await supabase.from('profiles').select('id,full_name,account_type,role').eq('id', user.id).maybeSingle();
        if (error || !data) throw new Error('profile_unavailable');
        if (data.role === 'admin') { active = false; window.location.replace(`/${locale}/admin`); return; }
        if (data.account_type === 'merchant') { active = false; window.location.replace(`/${locale}/store-dashboard`); return; }
        if (!active) return;
        setProfile(data);
        setName(data.full_name ?? '');
        setEmail(user.email ?? '');
        setPhone(user.phone ?? '');
        setConnectedProviders((user.identities ?? []).map((identity) => identity.provider));
      } catch {
        if (active) setNotice({ kind: 'error', text: tx('تعذر تحميل الملف الشخصي. حاول مرة أخرى.', 'Could not load the profile. Please try again.') });
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAccount();
    return () => { active = false; };
  }, [configured, locale, tx, favoritesPage, legacyFavorites]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !name.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      const { data, error } = await createSupabaseBrowserClient()
        .from('profiles')
        .update({ full_name: name.trim() })
        .eq('id', profile.id)
        .select('id,full_name,account_type,role')
        .maybeSingle();
      if (error || !data) throw new Error('profile_not_saved');
      setProfile(data);
      setName(data.full_name ?? '');
      setNotice({ kind: 'success', text: tx('تم حفظ بيانات حسابك.', 'Your account details were saved.') });
    } catch {
      setNotice({ kind: 'error', text: tx('تعذر حفظ البيانات. حاول مرة أخرى.', 'Could not save your details. Please try again.') });
    } finally {
      setSaving(false);
    }
  }



  async function signOut() {
    const { error } = await createSupabaseBrowserClient().auth.signOut();
    if (error) {
      setNotice({ kind: 'error', text: tx('تعذر تسجيل الخروج. حاول مرة أخرى.', 'Could not sign out. Please try again.') });
      return;
    }
    router.replace(`/${locale}`);
    router.refresh();
  }

  if (loading || legacyFavorites) return null;
  if (!configured) return <main className="onboarding-page" dir={ar ? 'rtl' : 'ltr'}><section className="onboarding-card"><div className="onboarding-message error">{tx('الحسابات غير متاحة في النسخة التجريبية.', 'Accounts are unavailable in the demo version.')}</div></section></main>;

  return (
    <main className="onboarding-page" dir={ar ? 'rtl' : 'ltr'} lang={locale}>
      <header className="onboarding-header"><PageBrand locale={locale} /><button className="outline-btn account-sign-out" type="button" onClick={() => void signOut()}><LogOut size={15}/>{tx('تسجيل الخروج', 'Sign out')}</button></header>
      <section className="onboarding-card account-portal-card customer-account-card">
        {favoritesPage ? (
          <>
            {profile && <SavedPieces locale={locale} profileId={profile.id} />}
            {notice && <div className="onboarding-message error" role="alert">{notice.text}</div>}
          </>
        ) : (
          <>
            <div className="eyebrow dark"><span/> {tx('حساب المتسوق', 'SHOPPER ACCOUNT')}</div>
            {profile && <nav className="customer-account-sections" aria-label={tx('أقسام حساب المتسوق', 'Shopper account sections')}>
              <a href="#account-details" aria-current={showWardrobe ? undefined : 'location'}><UserRound size={17} aria-hidden="true"/>{tx('حسابي', 'My account')}</a>
              <a href={'/' + locale + '/favorites'}><Heart size={17} aria-hidden="true"/>{tx('مفضلاتي', 'My favorites')}</a>
              <a href="#wardrobe" aria-current={showWardrobe ? 'location' : undefined}>{tx('دولابي', 'My wardrobe')}</a>
              <a href={`/${locale}/subscriptions`}>{tx('الاشتراكات', 'Subscriptions')}</a>
            </nav>}
            {profile && showWardrobe && <Wardrobe key={profile.id} owner={profile.id} locale={locale} />}
            {!(showWardrobe && profile) && (
              <div id="account-details" className="customer-account-details">
                <h1>{tx('بيانات حسابي', 'My account')}</h1>
                <p>{tx('حدّث بياناتك الشخصية واربط حساباتك الاجتماعية.', 'Update your personal details and connect social accounts.')}</p>
                {notice && <div className={`onboarding-message ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
                <form className="onboarding-form" onSubmit={saveProfile}>
                  <label>{tx('الاسم الشخصي', 'Your name')}<input required maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
                  <label>{tx('البريد الإلكتروني', 'Email address')}<input type="email" value={email} readOnly /></label>
                  {phone && <label>{tx('رقم الهاتف المؤكد', 'Verified phone number')}<input type="tel" value={phone} readOnly /></label>}
                  <button className="primary-btn sign-in-submit" type="submit" disabled={saving || !profile}>{saving ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ بيانات الحساب', 'Save account details')}</button>
                </form>
                <div className="account-link-settings"><h2>{tx('ربط حساب اجتماعي', 'Connect a social account')}</h2><p>{tx('يمكنك استخدام الحساب المرتبط لتسجيل الدخول مستقبلًا.', 'Use a connected account to sign in next time.')}</p><AuthProviderButtons locale={locale} mode="link" redirectPath={`/${locale}/account`} connectedProviders={connectedProviders}/></div>
                {profile && <EmailPreference locale={locale} />}
                {profile && <AccountDeletion locale={locale} accountType="customer" />}
              </div>
            )}
          </>
        )}
        <a className="outline-btn account-back-home" href={favoritesPage ? homePath(locale) + '#discover' : `/${locale}`}>{tx('العودة لاكتشاف الملابس', 'Back to clothing discovery')} ↗</a>
      </section>
    </main>
  );
}
