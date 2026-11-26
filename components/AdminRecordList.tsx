'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import type { Locale } from '@/lib/catalog';
import { formatNumber } from '@/lib/number-format';

type PageData<T> = { rows: T[]; total: number; pageSize: number };
type ListResult<T> = { key: string; data: PageData<T> | null };
type AdminActionResponse = { error?: string; approved_count?: number; archived_count?: number; deleted?: boolean };

type Props<T> = {
  locale: Locale;
  endpoint: string;
  field: 'applications' | 'shoppers';
  status: string;
  revision: number;
  placeholder: string;
  getLabel: (row: T) => string;
  renderRecord: (row: T) => ReactNode;
  renderActions?: (selected: T[]) => ReactNode;
};

export function AdminRecordList<T extends { id: string }>({
  locale, endpoint, field, status, revision, placeholder, getLabel, renderRecord, renderActions,
}: Props<T>) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [result, setResult] = useState<ListResult<T> | null>(null);
  const tx = (ar: string, en: string) => locale === 'ar' ? ar : en;
  const number = (value: number) => formatNumber(value, locale);
  const params = new URLSearchParams({ status, q: search, page: String(page) });
  const url = `${endpoint}?${params}`;
  const key = `${url}:${revision}:${refresh}`;
  const loaded = result?.key === key ? result : null;
  const rows = loaded?.data?.rows ?? [];
  const selected = rows.filter((row) => selection.has(row.id));
  const pages = Math.max(1, Math.ceil((loaded?.data?.total ?? 0) / (loaded?.data?.pageSize ?? 1)));

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('list_unavailable');
        const body = await response.json() as {
          applications?: T[];
          shoppers?: T[];
          total: number;
          pageSize: number;
        };
        const records = body[field];
        if (!Array.isArray(records) || !Number.isInteger(body.total) || body.total < 0
          || !Number.isInteger(body.pageSize) || body.pageSize <= 0) {
          throw new Error('invalid_list_response');
        }
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(body.total / body.pageSize));
        if (page > lastPage) {
          setPage(lastPage);
          setSelection(new Set());
          return;
        }
        setResult({ key, data: { rows: records, total: body.total, pageSize: body.pageSize } });
      } catch {
        if (!controller.signal.aborted) setResult({ key, data: null });
      }
    }
    void load();
    return () => controller.abort();
  }, [field, key, page, url]);

  function goToPage(nextPage: number) {
    setSelection(new Set());
    setPage(nextPage);
  }

  function toggleRow(id: string, checked: boolean) {
    setSelection((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <>
      <form className="admin-record-search" onSubmit={(event) => {
        event.preventDefault();
        setSearch(draft.trim());
        goToPage(1);
      }}>
        <label>
          {tx('البحث في السجلات', 'Search records')}
          <input type="search" maxLength={120} value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} />
        </label>
        <button className="primary-btn" type="submit"><Search size={15} />{tx('بحث', 'Search')}</button>
        {search && <button className="outline-btn" type="button" onClick={() => {
          setDraft('');
          setSearch('');
          goToPage(1);
        }}>{tx('مسح البحث', 'Clear search')}</button>}
        <button className="outline-btn" type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={15} />{tx('تحديث', 'Refresh')}</button>
      </form>

      {!loaded && <p className="admin-state" role="status">{tx('جارٍ تحميل السجلات…', 'Loading records…')}</p>}
      {loaded && !loaded.data && <p className="admin-state is-error" role="alert">{tx('تعذر تحميل السجلات. حدّث القائمة وحاول مجددًا.', 'Could not load records. Refresh the list and try again.')}</p>}
      {loaded?.data && rows.length === 0 && <p className="admin-state">{search
        ? tx('لا توجد نتائج تطابق البحث.', 'No records match your search.')
        : tx('لا توجد سجلات في هذا القسم.', 'There are no records in this section.')}</p>}

      {rows.length > 0 && (
        <>
          <div className="admin-record-selection">
            <label>
              <input type="checkbox" checked={selected.length === rows.length} onChange={(event) => {
                setSelection(new Set(event.target.checked ? rows.map((row) => row.id) : []));
              }} />
              {tx('تحديد سجلات الصفحة', 'Select records on this page')}
            </label>
            <span aria-live="polite">{tx(`المحدد ${number(selected.length)} من ${number(rows.length)}`, `${number(selected.length)} of ${number(rows.length)} selected`)}</span>
            {renderActions?.(selected)}
          </div>
          <div className="admin-review-list">
            {rows.map((row) => (
              <article className={`admin-review-card admin-record-card${selection.has(row.id) ? ' is-marked' : ''}`} key={row.id}>
                <input type="checkbox" checked={selection.has(row.id)} onChange={(event) => toggleRow(row.id, event.target.checked)}
                  aria-label={tx(`تحديد ${getLabel(row)}`, `Select ${getLabel(row)}`)} />
                <div className="admin-review-main">{renderRecord(row)}</div>
              </article>
            ))}
          </div>
          <div className="admin-record-pages">
            <span>{tx(`${number(loaded?.data?.total ?? 0)} سجل`, `${number(loaded?.data?.total ?? 0)} records`)}</span>
            {pages > 1 && <>
              <button className="outline-btn" type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>{tx('السابق', 'Previous')}</button>
              <span>{tx(`صفحة ${number(page)} من ${number(pages)}`, `Page ${number(page)} of ${number(pages)}`)}</span>
              <button className="outline-btn" type="button" disabled={page >= pages} onClick={() => goToPage(page + 1)}>{tx('التالي', 'Next')}</button>
            </>}
          </div>
        </>
      )}
    </>
  );
}

export async function updateAdminRecord(endpoint: string, payload: Record<string, string>) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null) as AdminActionResponse | null;
  if (!response.ok || !body) throw new Error(body?.error ?? 'action_failed');
  return body;
}

export async function permanentlyDeleteSelected(
  endpoint: string,
  idField: 'shopper_id' | 'store_id',
  records: { id: string }[],
  locale: Locale,
) {
  let deleted = 0;
  const failures: unknown[] = [];

  for (const record of records) {
    try {
      const result = await updateAdminRecord(endpoint, { action: 'purge', [idField]: record.id });
      if (result.deleted !== true) throw new Error('permanent_delete_failed');
      deleted += 1;
    } catch (error) {
      failures.push(error);
    }
  }

  const tx = (ar: string, en: string) => locale === 'ar' ? ar : en;
  const parts: string[] = [];
  if (deleted > 0) {
    const count = formatNumber(deleted, locale);
    parts.push(tx(`تم الحذف النهائي لـ ${count} من السجلات.`, `Permanently deleted ${count} selected records.`));
  }
  if (failures.length) {
    const count = formatNumber(failures.length, locale);
    parts.push(tx(`تعذّر حذف ${count} من السجلات.`, `Could not delete ${count} selected records.`));
    parts.push(permanentAccountDeletionError(failures[0], locale));
  }
  return { text: parts.join(' '), error: failures.length > 0 };
}

export function permanentAccountDeletionError(error: unknown, locale: Locale) {
  const ar = locale === 'ar';
  switch (error instanceof Error ? error.message : '') {
    case 'protected_account':
      return ar ? 'هذا الحساب محمي من الحذف النهائي.' : 'This account is protected from permanent deletion.';
    case 'permanent_delete_retry':
      return ar ? 'لم تكتمل إزالة صور المحل. أعد تحديده واضغط «حذف نهائي» لاستكمالها.' : 'Store image removal is incomplete. Select it and choose “Delete permanently” again to finish.';
    case 'record_not_found':
    case 'record_not_archived':
      return ar ? 'السجل لم يعد في المحذوفات. حدّث القائمة للتحقق من حالته.' : 'This record is no longer in deleted accounts. Refresh the list to check its status.';
    default:
      return ar ? 'تعذّر إكمال الحذف النهائي. حدّث القائمة وحاول مجددًا.' : 'Could not complete permanent deletion. Refresh the list and try again.';
  }
}
