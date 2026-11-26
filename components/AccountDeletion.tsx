'use client';

import { useEffect, useId, useState } from 'react';
import type { Locale } from '@/lib/catalog';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import './account-deletion.css';

type DeletionStatus = {
  eligible: boolean;
  account_type: 'customer' | 'merchant' | null;
  pending: boolean;
  recent_authentication: boolean;
};

export function AccountDeletion({ locale, accountType }: { locale: Locale; accountType: 'customer' | 'merchant' }) {
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fieldId = useId();
  const tx = (ar: string, en: string) => locale === 'ar' ? ar : en;

  useEffect(() => {
    const controller = new AbortController();
    async function readStatus() {
      try {
        const response = await fetch('/api/account/delete', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data: DeletionStatus = await response.json();
        if (!controller.signal.aborted) setStatus(data);
      } catch {
        // Other account actions remain usable when the deletion service is unavailable.
      }
    }
    void readStatus();
    return () => controller.abort();
  }, []);

  async function signInAgain() {
    setBusy(true);
    setError('');
    try {
      const { error: signOutError } = await createSupabaseBrowserClient().auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      window.location.replace(`/${locale}/login`);
    } catch {
      setError('reauthentication_failed');
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError('');
    try {
      for (let batch = 0; batch < 12; batch++) {
        const response = await fetch('/api/account/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed: true }),
        });
        const data: { deleted?: boolean; error?: string } = await response.json();
        if (response.status === 202) {
          setStatus((current) => current && { ...current, pending: true });
          continue;
        }
        if (response.ok && data.deleted) {
          await createSupabaseBrowserClient().auth.signOut({ scope: 'local' }).catch(() => undefined);
          window.location.replace(`/${locale}`);
          return;
        }
        const errorCode = data.error ?? 'deletion_unavailable';
        if (errorCode === 'reauthentication_required' || errorCode === 'authentication_required') {
          setStatus((current) => current && { ...current, recent_authentication: false });
        }
        if (errorCode === 'cleanup_interrupted') setStatus((current) => current && { ...current, pending: true });
        setError(errorCode);
        return;
      }
      setError('cleanup_interrupted');
    } catch {
      setError('deletion_unavailable');
    } finally {
      setBusy(false);
    }
  }

  if (!status?.eligible || status.account_type !== accountType) return null;

  let errorText = tx('تعذر إكمال الحذف الآن. حاول مرة أخرى أو تواصل معنا.', 'Could not complete deletion. Try again or contact us.');
  if (error === 'support_required') {
    errorText = tx(
      'الحساب مرتبط بمحل مشترك أو ببيانات تحتاج مراجعة. تواصل معنا عشان نساعدك في طلبك.',
      'This account has a shared store or records that need review. Contact us for help with your request.',
    );
  } else if (error === 'cleanup_interrupted') {
    errorText = tx('الحذف لسه قيد التنفيذ. اضغط متابعة الحذف لإكماله.', 'Deletion is in progress. Choose Continue deletion to finish.');
  } else if (error === 'reauthentication_failed') {
    errorText = tx('تعذر تسجيل الخروج. جرّب تسجيل الخروج من قائمة حسابك.', 'We could not sign you out. Try signing out from your account menu.');
  }

  const label = status.pending
    ? tx('متابعة الحذف', 'Continue deletion')
    : tx('حذف الحساب نهائيًا', 'Permanently delete account');

  return <section className="account-delete-section" aria-labelledby={`${fieldId}-heading`}>
    <h3 id={`${fieldId}-heading`}>{tx('حذف الحساب', 'Delete account')}</h3>
    {!expanded ? (
      <button className="outline-btn account-delete-button" type="button" onClick={() => setExpanded(true)}>{label}</button>
    ) : (
      <>
        <p>{accountType === 'merchant'
          ? tx(
            'يحذف الإجراء حساب الدخول وبياناتك والمتاجر اللي تملكها وحدك، بما فيها صفحاتها ومنتجاتها وصورها. إثبات قبول الشروط والاطلاع على الخصوصية يبقى في سجل محدود البيانات.',
            'This removes your sign-in, account details, and stores you own alone, including their pages, products, and images. A limited record of terms acceptance and privacy acknowledgement is retained.',
          )
          : tx(
            'يحذف الإجراء حساب الدخول وبياناتك ومفضلاتك. إثبات قبول الشروط والاطلاع على الخصوصية يبقى في سجل محدود البيانات.',
            'This removes your sign-in, account details, and favorites. A limited record of terms acceptance and privacy acknowledgement is retained.',
          )}</p>
        {!status.recent_authentication ? (
          <>
            <p>{tx('سجّل الدخول من جديد لتأكيد هويتك، وبعدها ارجع للإعدادات لإكمال الحذف.', 'Sign in again to verify your identity, then return to settings to complete deletion.')}</p>
            <button className="outline-btn" type="button" disabled={busy} onClick={() => void signInAgain()}>{tx('تسجيل الدخول من جديد', 'Sign in again')}</button>
          </>
        ) : (
          <>
            <label className="account-delete-confirm" htmlFor={fieldId}>
              <input id={fieldId} type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />
              {tx('أؤكد حذف الحساب نهائيًا. الإجراء لا يمكن التراجع عنه.', 'I confirm permanent account deletion. This cannot be undone.')}
            </label>
            <button className="outline-btn account-delete-button" type="button" disabled={busy || !confirmed} onClick={() => void deleteAccount()}>
              {busy ? tx('جارٍ الحذف…', 'Deleting…') : label}
            </button>
          </>
        )}
        {error && (
          <p role="alert">
            {errorText} <a href="mailto:cairoclothes2026@gmail.com">cairoclothes2026@gmail.com</a>
          </p>
        )}
      </>
    )}
  </section>;
}
