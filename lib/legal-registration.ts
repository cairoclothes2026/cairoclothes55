import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/lib/catalog';
import { LEGAL_VERSION } from '@/lib/legal';

export type LegalAccountType = 'customer' | 'merchant';
export type LegalRegistrationStatus = {
  required: boolean;
  account_type: LegalAccountType;
  can_choose_type: boolean;
  is_new: boolean;
};

type RegistrationIntent = {
  accountType: LegalAccountType;
  locale: Locale;
  version: string;
  createdAt: number;
  emailHash?: string;
  provider?: string;
};

const key = 'cc.legal.registration.';
const intentLifetime = 2 * 60 * 60 * 1000;
const intentPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function hashIntentEmail(id: string, email: string) {
  const input = new TextEncoder().encode(id + ':' + email.toLowerCase().trim());
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function saveRegistrationIntent({ email, ...intent }: Pick<RegistrationIntent, 'accountType' | 'locale' | 'provider'> & { email?: string }) {
  try {
    const id = crypto.randomUUID();
    const now = Date.now();
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const storedKey = localStorage.key(index);
      if (!storedKey?.startsWith(key)) continue;
      try {
        const item = JSON.parse(localStorage.getItem(storedKey) ?? 'null') as RegistrationIntent | null;
        if (!item || item.version !== LEGAL_VERSION || now - item.createdAt > intentLifetime) localStorage.removeItem(storedKey);
      } catch { localStorage.removeItem(storedKey); }
    }
    // Confirmation emails may open another tab. The browser keeps a short-lived
    // intent keyed to this redirect, without storing the email address itself.
    const emailHash = email ? await hashIntentEmail(id, email) : undefined;
    localStorage.setItem(key + id, JSON.stringify({ ...intent, emailHash, version: LEGAL_VERSION, createdAt: now }));
    return id;
  } catch {
    // The continuation screen will request explicit acceptance if storage is unavailable.
    return undefined;
  }
}

export async function readRegistrationIntent(id: string | undefined, user: { email?: string; app_metadata: Record<string, unknown> }) {
  if (!id || !intentPattern.test(id)) return null;
  try {
    const raw = localStorage.getItem(key + id);
    if (!raw) return null;
    const intent = JSON.parse(raw) as RegistrationIntent;
    if (intent.version !== LEGAL_VERSION || Date.now() - intent.createdAt > intentLifetime) {
      clearRegistrationIntent(id);
      return null;
    }
    if (intent.accountType !== 'customer' && intent.accountType !== 'merchant') return null;
    if (intent.locale !== 'ar' && intent.locale !== 'en') return null;
    if (intent.emailHash) {
      if (!user.email || intent.emailHash !== await hashIntentEmail(id, user.email)) return null;
    } else if (!intent.provider || intent.provider !== user.app_metadata.provider) {
      return null;
    }
    return intent;
  } catch {
    return null;
  }
}

export function registrationContinuationPath(locale: Locale, accountType?: LegalAccountType, intentId?: string) {
  const query = new URLSearchParams();
  if (accountType) query.set('accountType', accountType);
  if (intentId) query.set('legalIntent', intentId);
  return `/${locale}/auth/continue${query.size ? '?' + query.toString() : ''}`;
}

export function clearRegistrationIntent(id: string | undefined) {
  if (!id || !intentPattern.test(id)) return;
  try { localStorage.removeItem(key + id); } catch { /* Storage may be unavailable. */ }
}

export async function legalRegistrationStatus(supabase: SupabaseClient): Promise<LegalRegistrationStatus> {
  const { data, error } = await supabase.rpc('legal_registration_status');
  if (error || typeof data?.required !== 'boolean') throw new Error('legal_status_unavailable');
  return data as LegalRegistrationStatus;
}

export async function recordLegalAcceptance(supabase: SupabaseClient, accountType: LegalAccountType, locale: Locale) {
  const { error } = await supabase.rpc('record_legal_acceptance', {
    p_account_type: accountType,
    p_locale: locale,
    p_version: LEGAL_VERSION,
    p_accepted: true,
  });
  if (error) throw new Error('legal_consent_record_failed');
}
