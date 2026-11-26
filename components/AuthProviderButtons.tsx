'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/catalog';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { SOCIAL_AUTH_PROVIDERS, type AuthAccountType, type SocialAuthProvider } from '@/lib/auth-providers';
import { clearRegistrationIntent, saveRegistrationIntent } from '@/lib/legal-registration';

type Mode = 'register' | 'login' | 'link';
type Props = {
  locale: Locale;
  mode: Mode;
  accountType?: AuthAccountType;
  redirectPath?: string;
  connectedProviders?: string[];
  legalConsentConfirmed?: boolean;
};

export function AuthProviderButtons({ locale, mode, accountType = 'customer', redirectPath, connectedProviders = [], legalConsentConfirmed = false }: Props) {
  const ar = locale === 'ar';
  const [busyProvider, setBusyProvider] = useState<SocialAuthProvider | null>(null);
  const [error, setError] = useState('');

  async function start(provider: SocialAuthProvider) {
    const providerConfig = SOCIAL_AUTH_PROVIDERS.find((item) => item.id === provider);
    if (!providerConfig || (mode === 'register' && !legalConsentConfirmed)) return;
    setBusyProvider(provider);
    setError('');
    let intentId: string | undefined;
    try {
      const destination = mode === 'register'
        ? new URL(`/${locale}/auth/continue`, window.location.origin)
        : new URL(redirectPath ?? `/${locale}/auth/continue`, window.location.origin);
      if (mode === 'register') {
        destination.searchParams.set('accountType', accountType);
        intentId = await saveRegistrationIntent({ accountType, locale, provider });
        if (intentId) destination.searchParams.set('legalIntent', intentId);
        if (providerConfig.emailOtpOnSignupFor?.includes(accountType)) destination.searchParams.set('emailOtp', provider);
      }
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('next', `${destination.pathname}${destination.search}`);
      const supabase = createSupabaseBrowserClient();
      const options = {
        redirectTo: callback.toString(),
        scopes: providerConfig.scopes,
      };
      const { error: authError } = mode === 'link'
        ? await supabase.auth.linkIdentity({ provider, options })
        : await supabase.auth.signInWithOAuth({ provider, options });
      if (authError) throw authError;
    } catch {
      clearRegistrationIntent(intentId);
      setBusyProvider(null);
      setError(mode === 'link'
        ? (ar ? 'تعذر ربط الحساب. حاول مرة أخرى أو تواصل مع الدعم.' : 'Could not link this account. Try again or contact support.')
        : (ar ? `تعذر فتح ${providerConfig.label}. حاول مرة أخرى.` : `Could not open ${providerConfig.label}. Please try again.`));
    }
  }

  return (
    <>
      <div className={`account-social-buttons${mode === 'link' ? ' account-link-actions' : ''}`}>
        {SOCIAL_AUTH_PROVIDERS.map((provider) => {
          const connected = connectedProviders.includes(provider.id);
          const label = mode === 'link'
            ? connected ? (ar ? `${provider.label} مرتبط` : `${provider.label} connected`) : (ar ? `ربط ${provider.label}` : `Connect ${provider.label}`)
            : (ar ? `المتابعة باستخدام ${provider.label}` : `Continue with ${provider.label}`);
          return (
            <button
              key={provider.id}
              type="button"
              disabled={Boolean(busyProvider) || connected || (mode === 'register' && !legalConsentConfirmed)}
              onClick={() => void start(provider.id)}
            >
              <b className={`social-mark ${provider.id}-mark`}>{provider.mark}</b>
              {busyProvider === provider.id
                ? (ar ? `جارٍ فتح ${provider.label}…` : `Opening ${provider.label}…`)
                : label}
            </button>
          );
        })}
      </div>
      {error && <div className="onboarding-message error" role="alert">{error}</div>}
    </>
  );
}
