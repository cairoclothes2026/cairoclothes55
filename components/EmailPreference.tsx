'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import type { Locale } from '@/lib/catalog';

export function EmailPreference({ locale, token }: { locale: Locale; token?: string }) {
  const ar = locale === 'ar';
  const [stopped, setStopped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (token !== undefined) return;
    let active = true;
    void (async () => {
      const { data, error } = await createSupabaseBrowserClient().rpc('my_marketing_preference', { stop_mail: false });
      if (active && !error && data) setStopped(true);
    })();
    return () => { active = false; };
  }, [token]);
  async function stop() {
    setBusy(true);
    try {
      const client = createSupabaseBrowserClient();
      const { data, error } = token === undefined
        ? await client.rpc('my_marketing_preference', { stop_mail: true })
        : await client.rpc('stop_marketing_by_token', { token });
      if (error || !data) throw new Error();
      setFailed(false); setStopped(true);
    } catch { setFailed(true); } finally { setBusy(false); }
  }
  return <section className="account-link-settings">
    <h2>{ar ? 'البريد التسويقي' : 'Marketing email'}</h2>
    {stopped ? <p role="status">{ar ? 'تم إيقاف رسائل التسويق لهذا البريد.' : 'Marketing email is turned off for this address.'}</p> :
      <button type="button" className="outline-btn" disabled={busy} onClick={stop}>{ar ? 'إلغاء الاشتراك في رسائل التسويق' : 'Unsubscribe from marketing email'}</button>}
    {failed && <p role="alert">{ar ? 'تعذر حفظ الطلب. أعد المحاولة أو تواصل معنا.' : 'Could not save your request. Try again or contact us.'} <a href="mailto:cairoclothes2026@gmail.com">CAIROCLOTHES2026@GMAIL.COM</a></p>}
  </section>;
}
