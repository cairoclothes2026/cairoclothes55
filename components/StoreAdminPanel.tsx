'use client';

import { useEffect, useState } from 'react';
import { Check, Clock3, RotateCcw, Store, Trash2, X } from 'lucide-react';
import { AdminDeletionDialog } from '@/components/AdminDeletionDialog';
import { AdminRecordList, permanentlyDeleteSelected, updateAdminRecord } from '@/components/AdminRecordList';
import type { Locale } from '@/lib/catalog';
import { formatDate, formatNumber } from '@/lib/number-format';

type StoreApplication = {
  id: string;
  owner_id: string | null;
  owner_email: string | null;
  slug: string;
  name_ar: string;
  name_en: string;
  area_id: string;
  area_name_ar: string | null;
  area_name_en: string | null;
  address_ar: string;
  address_en: string;
  contact_name: string | null;
  phone: string | null;
  status: 'pending' | 'active' | 'paused' | 'rejected';
  admin_archived_at: string | null;
  approved_at: string | null;
  created_at: string;
};
type StoreFilter = 'approved' | 'pending' | 'deleted' | 'rejected';
type StoreAction = 'approve' | 'reject' | 'archive' | 'restore';
const endpoint = '/api/admin/store-applications';

export function StoreAdminPanel({ locale, userId }: { locale: Locale; userId: string }) {
  const [filter, setFilter] = useState<StoreFilter>('pending');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState('');
  const [deleting, setDeleting] = useState<StoreApplication[] | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (filter !== 'pending') return;
    function refreshOnReturn() {
      if (document.visibilityState === 'visible') setRevision((value) => value + 1);
    }
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => document.removeEventListener('visibilitychange', refreshOnReturn);
  }, [filter]);

  const ar = locale === 'ar';
  const tx = (arabic: string, english: string) => ar ? arabic : english;
  const name = (store: StoreApplication) => (ar ? store.name_ar : store.name_en) || store.name_ar || store.name_en || store.slug;
  const statusLabels: Record<StoreApplication['status'], string> = {
    active: tx('معتمد ومنشور', 'Approved and published'),
    pending: tx('قيد المراجعة', 'Pending review'),
    paused: tx('موقوف مؤقتًا', 'Paused'),
    rejected: tx('مرفوض', 'Rejected'),
  };
  const tabs = [
    { key: 'approved', label: tx('المحلات المعتمدة', 'Approved stores') },
    { key: 'pending', label: tx('الطلبات المعلّقة', 'Pending applications') },
    { key: 'deleted', label: tx('المحلات والطلبات المحذوفة', 'Deleted stores and applications') },
  ] as const;

  async function changeStore(store: StoreApplication, action: StoreAction) {
    const label = name(store);
    const prompts: Record<StoreAction, string> = {
      approve: tx(`اعتماد «${label}» ونشره في الدليل؟`, `Approve “${label}” and publish it in the directory?`),
      reject: tx(`رفض طلب «${label}»؟`, `Reject the application for “${label}”?`),
      archive: tx(`نقل «${label}» إلى المحذوفات وإخفاؤه من الدليل؟ يمكنك استعادته لاحقًا.`,
        `Move “${label}” to deleted records and hide it from the directory? It can be restored later.`),
      restore: tx(`استعادة «${label}» إلى حالته السابقة؟`, `Restore “${label}” to its previous status?`),
    };
    if (!window.confirm(prompts[action])) return;
    setBusy(store.id);
    setNotice(null);
    try {
      const payload: Record<string, string> = action === 'approve' || action === 'reject'
        ? { store_id: store.id, decision: action }
        : { store_id: store.id, action };
      await updateAdminRecord(endpoint, payload);
      const success: Record<StoreAction, string> = {
        approve: tx('تم اعتماد المحل ونشره.', 'Store approved and published.'),
        reject: tx('تم رفض الطلب.', 'Application rejected.'),
        archive: tx('نُقل السجل إلى المحذوفات.', 'Record moved to deleted stores.'),
        restore: tx('تمت استعادة الحالة السابقة.', 'Previous status restored.'),
      };
      setNotice({ text: success[action], error: false });
      setRevision((value) => value + 1);
    } catch (error) {
      let message = tx('تعذر تحديث السجل. حدّث القائمة وحاول مجددًا.', 'Could not update the record. Refresh the list and try again.');
      if (error instanceof Error && error.message === 'self_review_forbidden') {
        message = tx('يلزم مدير آخر لمراجعة طلب محلك.', 'Another administrator must review your store application.');
      } else if (error instanceof Error && error.message === 'account_purge_in_progress') {
        message = tx('بدأ الحذف النهائي لهذا المحل. حدّده واضغط «حذف نهائي» لإكماله.', 'Permanent deletion has started. Select the store and choose “Delete permanently” to finish.');
      }
      setNotice({ error: true, text: message });
    } finally {
      setBusy('');
    }
  }

  async function deleteStores(records: StoreApplication[]) {
    setDeleting(null);
    setBusy('purge');
    setNotice(null);
    try {
      setNotice(await permanentlyDeleteSelected(endpoint, 'store_id', records, locale));
      setRevision((value) => value + 1);
    } finally {
      setBusy('');
    }
  }

  async function approveSelected(stores: StoreApplication[]) {
    const count = formatNumber(stores.length, locale);
    if (!stores.length || !window.confirm(tx(`اعتماد ونشر الطلبات المحددة وعددها ${count}؟`, `Approve and publish the ${count} selected applications?`))) return;
    setBusy('selected');
    setNotice(null);
    let approved = 0;
    for (const store of stores) {
      try {
        await updateAdminRecord(endpoint, { store_id: store.id, decision: 'approve' });
        approved += 1;
      } catch {
        // Continue with the other selected applications and report the actual totals.
      }
    }
    const successful = formatNumber(approved, locale);
    const failed = formatNumber(stores.length - approved, locale);
    setNotice({
      error: approved !== stores.length,
      text: approved === stores.length
        ? tx(`تم اعتماد ${successful} من الطلبات المحددة.`, `Approved ${successful} selected applications.`)
        : tx(`تم اعتماد ${successful} وتعذّر اعتماد ${failed}.`, `Approved ${successful}. Could not approve ${failed}.`),
    });
    setRevision((value) => value + 1);
    setBusy('');
  }

  async function changeAllStores(action: 'approve_all_pending' | 'archive_all') {
    const approving = action === 'approve_all_pending';
    const prompt = approving
      ? tx('اعتماد ونشر كل الطلبات المعلّقة المؤهلة؟ سيُستثنى طلب محلك.', 'Approve and publish all eligible pending applications? Your own store is excluded.')
      : tx('إزالة كل المحلات والطلبات من الدليل ونقلها إلى المحذوفات؟ يشمل ذلك المعتمدة والمعلّقة.', 'Remove every store and application from the directory and move them to deleted records? This includes approved and pending stores.');
    if (!window.confirm(prompt)) return;
    setBusy(action);
    setNotice(null);
    try {
      const result = await updateAdminRecord(endpoint, { action });
      const count = formatNumber((approving ? result.approved_count : result.archived_count) ?? 0, locale);
      setNotice({ error: false, text: approving
        ? tx(`تم اعتماد ${count} من الطلبات المعلّقة.`, `Approved ${count} pending applications.`)
        : tx(`نُقل ${count} من المحلات والطلبات إلى المحذوفات.`, `Moved ${count} stores and applications to deleted records.`) });
      setRevision((value) => value + 1);
    } catch {
      setNotice({ error: true, text: tx('تعذر تنفيذ الإجراء على المحلات والطلبات.', 'Could not update the stores and applications.') });
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="admin-panel admin-review-panel" aria-labelledby="store-records-title">
      <div className="panel-heading">
        <div><h2 id="store-records-title">{tx('حسابات المحلات', 'Store accounts')}</h2>
          <p>{tx('راجع طلبات الانضمام وأدر المحلات المسجلة والسجلات المحذوفة.', 'Review applications and manage approved stores and deleted records.')}</p></div>
      </div>
      <div className="admin-record-tabs" role="group" aria-label={tx('حالة المحل أو الطلب', 'Store or application status')}>
        {tabs.map((tab) => <button key={tab.key} className="outline-btn" type="button"
          aria-pressed={filter === tab.key || (tab.key === 'pending' && filter === 'rejected')}
          onClick={() => setFilter(tab.key)}>{tab.label}</button>)}
      </div>
      {(filter === 'pending' || filter === 'rejected') && (
        <label className="admin-record-filter">
          {tx('عرض الطلبات', 'Show applications')}
          <select value={filter} onChange={(event) => setFilter(event.target.value === 'rejected' ? 'rejected' : 'pending')}>
            <option value="pending">{tx('بانتظار المراجعة', 'Awaiting review')}</option>
            <option value="rejected">{tx('مرفوضة', 'Rejected')}</option>
          </select>
        </label>
      )}
      {notice && <p className={`admin-state ${notice.error ? 'is-error' : 'is-success'}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      <AdminRecordList<StoreApplication>
        key={filter} locale={locale} endpoint={endpoint} field="applications" status={filter} revision={revision}
        placeholder={tx('اسم المحل، المسؤول، البريد، الهاتف أو العنوان', 'Store, contact, email, phone, or address')}
        getLabel={name}
        renderActions={filter === 'pending' ? (selected) => {
          const approvable = selected.filter((store) => store.owner_id !== userId);
          return <button className="outline-btn" type="button" disabled={Boolean(busy) || !approvable.length}
            onClick={() => void approveSelected(approvable)}><Check size={15} />{tx('اعتماد الطلبات المحددة', 'Approve selected applications')}</button>;
        } : filter === 'deleted' ? (selected) => (
          <button className="outline-btn admin-remove-record" type="button" disabled={Boolean(busy) || !selected.length} onClick={() => setDeleting(selected)}>
            <Trash2 size={15} />{busy === 'purge' ? tx('جارٍ الحذف…', 'Deleting…') : tx('حذف نهائي', 'Delete permanently')}
          </button>
        ) : undefined}
        renderRecord={(store) => {
          const ownPending = store.status === 'pending' && store.owner_id === userId;
          const archived = Boolean(store.admin_archived_at);
          return (
            <>
              <div className="admin-review-title">
                <div><span className="store-initial"><Store size={16} /></span><div><h3>{name(store)}</h3><small><bdi>{store.slug}</bdi></small></div></div>
                <span className={`admin-status-badge is-${archived ? 'archived' : store.status}`}>
                  {!archived && store.status === 'pending' && <Clock3 size={14} />}
                  {archived ? tx('محذوف من الدليل', 'Removed from directory') : statusLabels[store.status]}
                </span>
              </div>
              <div className="admin-review-details">
                <p><b>{tx('مسؤول التواصل', 'Contact')}</b> {store.contact_name || '—'}</p>
                <p><b>{tx('بريد المالك', 'Owner email')}</b> <bdi>{store.owner_email || '—'}</bdi></p>
                <p><b>{tx('الهاتف', 'Phone')}</b> <bdi>{store.phone || '—'}</bdi></p>
                <p><b>{tx('المنطقة', 'Area')}</b> {(ar ? store.area_name_ar : store.area_name_en) || store.area_id || '—'}</p>
                <p><b>{tx('العنوان', 'Address')}</b> {(ar ? store.address_ar : store.address_en) || '—'}</p>
                <p><b>{tx('تاريخ الطلب', 'Submitted')}</b> {formatDate(store.created_at, locale)}</p>
                {store.approved_at && <p><b>{tx('تاريخ الاعتماد', 'Approved')}</b> {formatDate(store.approved_at, locale)}</p>}
                {store.admin_archived_at && <p><b>{tx('تاريخ الحذف', 'Removed')}</b> {formatDate(store.admin_archived_at, locale)}</p>}
              </div>
              {ownPending && <p className="admin-state">{tx('يلزم مدير آخر لمراجعة طلب محلك.', 'Another administrator must review your store application.')}</p>}
              <div className="admin-review-actions">
                {!archived && store.status === 'pending' && <>
                  <button className="primary-btn" type="button" disabled={Boolean(busy) || ownPending} onClick={() => void changeStore(store, 'approve')}><Check size={15} />{tx('اعتماد ونشر', 'Approve and publish')}</button>
                  <button className="outline-btn" type="button" disabled={Boolean(busy) || ownPending} onClick={() => void changeStore(store, 'reject')}><X size={15} />{tx('رفض الطلب', 'Reject application')}</button>
                </>}
                <button className={`outline-btn${archived ? '' : ' admin-remove-record'}`} type="button" disabled={Boolean(busy)} onClick={() => void changeStore(store, archived ? 'restore' : 'archive')}>
                  {archived ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                  {busy === store.id ? tx('جارٍ التنفيذ…', 'Working…') : archived ? tx('استعادة السجل', 'Restore record') : tx('نقل إلى المحذوفات', 'Move to deleted')}
                </button>
              </div>
            </>
          );
        }}
      />
      {deleting && <AdminDeletionDialog locale={locale} names={deleting.map(name)} kind="store"
        onCancel={() => setDeleting(null)} onConfirm={() => void deleteStores(deleting)} />}
      <details className="admin-global-actions">
        <summary>{tx('إجراءات تشمل كل المحلات', 'Actions for all stores')}</summary>
        <div className="admin-review-actions">
          <button className="outline-btn" type="button" disabled={Boolean(busy)} onClick={() => void changeAllStores('approve_all_pending')}>{tx('اعتماد كل الطلبات المعلّقة المؤهلة', 'Approve all eligible pending applications')}</button>
          <button className="outline-btn admin-remove-record" type="button" disabled={Boolean(busy)} onClick={() => void changeAllStores('archive_all')}>{tx('إزالة كل المحلات والطلبات', 'Remove all stores and applications')}</button>
        </div>
      </details>
    </section>
  );
}
