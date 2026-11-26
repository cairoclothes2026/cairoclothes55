'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Locale } from '@/lib/catalog';
import { LEGAL_DOCUMENTS, type LegalDocumentId } from '@/lib/legal';
import { createSupabaseBrowserClient } from '@/lib/supabase';

type LegalEvent = {
  id: number | string;
  account_id: string;
  account_type: 'customer' | 'merchant';
  document_id: LegalDocumentId;
  version: string;
  document_hash: string;
  event_kind: 'accepted' | 'acknowledged';
  locale: Locale;
  provider: string;
  accepted_at: string;
  account_created_at: string | null;
  full_name: string | null;
  email: string | null;
};

export function LegalAdminPanel({ locale, view }: { locale: Locale; view: 'customer' | 'merchant' | 'privacy' }) {
  const ar = locale === 'ar';
  const [rows, setRows] = useState<LegalEvent[] | null>(null);
  const [search, setSearch] = useState('');
  const [revision, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' });

  const load = useCallback(async (before: number | string | null = null) => {
    const response = await createSupabaseBrowserClient().rpc('list_legal_acceptances', {
      p_account_type: view === 'privacy' ? null : view,
      p_before_id: before,
      p_document_id: view === 'privacy' ? 'privacy' : null,
    });
    if (response.error || !Array.isArray(response.data)) throw new Error('legal_list_unavailable');
    return response.data as LegalEvent[];
  }, [view]);

  useEffect(() => {
    let active = true;
    async function readHistory() {
      setBusy(true);
      setFailed(false);
      setRows(null);
      const history: LegalEvent[] = [];
      let before: string | number | null = null;
      try {
        while (active) {
          const page = await load(before);
          if (!active) return;
          history.push(...page);
          if (page.length < 50) break;
          before = page[page.length - 1].id;
        }
        if (active) setRows(history);
      } catch { if (active) setFailed(true); }
      finally { if (active) setBusy(false); }
    }
    void readHistory();
    return () => { active = false; };
  }, [load, revision]);

  const groups = new Map<string, LegalEvent[]>();
  for (const row of rows ?? []) {
    const group = groups.get(row.account_id);
    if (group) group.push(row);
    else groups.set(row.account_id, [row]);
  }
  const query = search.trim().toLocaleLowerCase();
  const matches = [...groups.entries()].filter(([, events]) => events.some(row => [
    ...Object.values(row), LEGAL_DOCUMENTS[row.document_id]?.title[locale], dates.format(new Date(row.accepted_at)),
  ].join(' ').toLocaleLowerCase().includes(query)));

  return <section className="admin-panel admin-review-panel">
    <div className="panel-heading">
      <p>{ar ? 'سجل للقراءة فقط يعرض المستند والإصدار وتاريخ تسجيل الموافقة لكل حساب.' : 'Read-only history of each account’s acceptance or acknowledgement, with document version and date.'}</p>
      <button className="outline-btn" type="button" disabled={busy || (!rows && !failed)} onClick={() => refresh(n => n + 1)}>{ar ? 'تحديث' : 'Refresh'}</button>
    </div>
    <label className="garment-field">{ar ? 'البحث في تفاصيل الموافقات' : 'Search acceptance details'}
      <input type="search" value={search} onChange={event => setSearch(event.target.value)} />
    </label>
    {rows && rows.length > 0 && !matches.length && <p role="status">{ar ? 'لا توجد نتائج مطابقة.' : 'No matching records.'}</p>}
    {failed && <p role="alert" className="admin-state is-error">{ar ? 'تعذر تحميل السجل. حاول مرة أخرى.' : 'Could not load the history. Try again.'}</p>}
    {!rows && !failed && <p role="status" className="admin-state">{ar ? 'جارٍ تحميل السجل…' : 'Loading history…'}</p>}
    {rows?.length === 0 && <p className="admin-state">{ar ? 'لا توجد موافقات مسجلة في هذا القسم حتى الآن.' : 'No records in this section yet.'}</p>}
    {!!rows?.length && <div className="admin-review-list">
       {matches.map(([account, events]) => <details key={account} className="admin-review-card">
        <summary><bdi>{events[0].full_name || events[0].email || account}</bdi> · {ar ? 'عدد السجلات' : 'Records'} {events.length}</summary>
        {events.map((row) => <article className="admin-review-card" key={row.id}>
        <h3>{LEGAL_DOCUMENTS[row.document_id]?.title[locale] ?? row.document_id}</h3>
        <p>{row.event_kind === 'acknowledged' ? (ar ? 'إقرار بالاطلاع' : 'Acknowledged') : (ar ? 'موافقة' : 'Accepted')} · <time dateTime={row.accepted_at}>{dates.format(new Date(row.accepted_at))}</time></p>
        <dl className="admin-review-details legal-audit-record">
          <div><dt>{ar ? 'الحساب' : 'Account'}</dt><dd>{row.full_name || row.email || '—'}{row.full_name && row.email ? <> · <bdi>{row.email}</bdi></> : null}</dd></div>
          <div><dt>{ar ? 'النوع' : 'Account type'}</dt><dd>{row.account_type === 'merchant' ? (ar ? 'محل' : 'Store') : (ar ? 'متسوق' : 'Shopper')}</dd></div>
          {row.account_created_at && <div><dt>{ar ? 'تاريخ إنشاء الحساب' : 'Account created'}</dt><dd><time dateTime={row.account_created_at}>{dates.format(new Date(row.account_created_at))}</time></dd></div>}
          <div><dt>{ar ? 'المعرّف' : 'Account ID'}</dt><dd dir="ltr"><code>{row.account_id}</code></dd></div>
          <div><dt>{ar ? 'طريقة الدخول واللغة' : 'Sign-in method and language'}</dt><dd><bdi>{row.provider} · {row.locale}</bdi></dd></div>
          <div><dt>{ar ? 'الإصدار' : 'Version'}</dt><dd><bdi>{row.version}</bdi></dd></div>
          <div><dt>{ar ? 'بصمة المستند' : 'Document hash'}</dt><dd dir="ltr"><code>{row.document_hash}</code></dd></div>
        </dl>
      </article>)}
      </details>)}
    </div>}
  </section>;
}
