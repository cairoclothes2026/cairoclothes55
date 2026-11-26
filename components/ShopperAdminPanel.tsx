'use client';

import { useState } from 'react';
import { RotateCcw, Trash2, UserRound } from 'lucide-react';
import { AdminDeletionDialog } from '@/components/AdminDeletionDialog';
import { AdminRecordList, permanentlyDeleteSelected, updateAdminRecord } from '@/components/AdminRecordList';
import type { Locale } from '@/lib/catalog';
import { formatDate } from '@/lib/number-format';

type Shopper = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  deleted_at: string | null;
  delete_reason: string | null;
};
type ShopperStatus = 'registered' | 'deleted';
const endpoint = '/api/admin/shopper-accounts';

export function ShopperAdminPanel({ locale }: { locale: Locale }) {
  const [status, setStatus] = useState<ShopperStatus>('registered');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState('');
  const [deleting, setDeleting] = useState<Shopper[] | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const tx = (ar: string, en: string) => locale === 'ar' ? ar : en;
  const label = (shopper: Shopper) => shopper.full_name || shopper.email || shopper.phone || tx('متسوّق', 'Shopper');
  const date = (value: string | null) => value ? formatDate(value, locale) : '—';

  async function changeAccount(shopper: Shopper) {
    const restore = Boolean(shopper.deleted_at);
    const message = restore
      ? tx(`استعادة حساب «${label(shopper)}»؟`, `Restore the account for “${label(shopper)}”?`)
      : tx(`نقل حساب «${label(shopper)}» إلى المحذوفات وإيقاف دخوله؟ يمكن استعادة الحساب وبياناته لاحقًا.`,
        `Move the account for “${label(shopper)}” to deleted accounts and disable sign-in? The account and its data can be restored.`);
    if (!window.confirm(message)) return;
    setBusy(shopper.id);
    setNotice(null);
    try {
      await updateAdminRecord(endpoint, { action: restore ? 'restore' : 'soft_delete', shopper_id: shopper.id });
      setRevision((value) => value + 1);
      const success = restore ? tx('تمت استعادة الحساب.', 'Account restored.') : tx('نُقل الحساب إلى المحذوفات.', 'Account moved to deleted accounts.');
      setNotice({ error: false, text: success });
    } catch {
      setNotice({ error: true, text: tx('تعذر تحديث الحساب. حدّث القائمة وحاول مجددًا.', 'Could not update the account. Refresh the list and try again.') });
    } finally {
      setBusy('');
    }
  }

  async function deleteShoppers(records: Shopper[]) {
    setDeleting(null);
    setBusy('purge');
    setNotice(null);
    try {
      setNotice(await permanentlyDeleteSelected(endpoint, 'shopper_id', records, locale));
      setRevision((value) => value + 1);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="admin-panel admin-review-panel" aria-labelledby="shopper-records-title">
      <div className="panel-heading">
        <div><h2 id="shopper-records-title">{tx('حسابات المتسوقين', 'Shopper accounts')}</h2>
          <p>{tx('ابحث في الحسابات المسجّلة والمحذوفة وراجع تفاصيلها.', 'Search registered and deleted accounts and review their details.')}</p></div>
      </div>
      <div className="admin-record-tabs" role="group" aria-label={tx('حالة حساب المتسوق', 'Shopper account status')}>
        <button className="outline-btn" type="button" aria-pressed={status === 'registered'} onClick={() => setStatus('registered')}>{tx('الحسابات المسجّلة', 'Registered accounts')}</button>
        <button className="outline-btn" type="button" aria-pressed={status === 'deleted'} onClick={() => setStatus('deleted')}>{tx('الحسابات المحذوفة', 'Deleted accounts')}</button>
      </div>
      {notice && <p className={`admin-state ${notice.error ? 'is-error' : 'is-success'}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      <AdminRecordList<Shopper>
        key={status} locale={locale} endpoint={endpoint} field="shoppers" status={status} revision={revision}
        placeholder={tx('الاسم، البريد، الهاتف أو معرّف الحساب', 'Name, email, phone, or account ID')}
        getLabel={label}
        renderActions={status === 'deleted' ? (selected) => (
          <button className="outline-btn admin-remove-record" type="button" disabled={Boolean(busy) || !selected.length} onClick={() => setDeleting(selected)}>
            <Trash2 size={15} />{busy === 'purge' ? tx('جارٍ الحذف…', 'Deleting…') : tx('حذف نهائي', 'Delete permanently')}
          </button>
        ) : undefined}
        renderRecord={(shopper) => (
          <>
            <div className="admin-review-title">
              <div><span className="store-initial"><UserRound size={16} /></span><h3><bdi>{label(shopper)}</bdi></h3></div>
              <span className={`admin-status-badge is-${shopper.deleted_at ? 'archived' : 'active'}`}>
                {shopper.deleted_at ? tx('محذوف', 'Deleted') : tx('مسجّل', 'Registered')}
              </span>
            </div>
            <div className="admin-review-details">
              <p><b>{tx('البريد الإلكتروني', 'Email')}</b> <bdi>{shopper.email || '—'}</bdi></p>
              <p><b>{tx('الهاتف', 'Phone')}</b> <bdi>{shopper.phone || '—'}</bdi></p>
              <p><b>{tx('معرّف الحساب', 'Account ID')}</b> <bdi>{shopper.id}</bdi></p>
              <p><b>{tx('تاريخ التسجيل', 'Registered')}</b> {date(shopper.created_at)}</p>
              <p><b>{tx('آخر دخول', 'Last sign-in')}</b> {date(shopper.last_sign_in_at)}</p>
              {shopper.deleted_at && <p><b>{tx('تاريخ الحذف', 'Deleted')}</b> {date(shopper.deleted_at)}</p>}
              {shopper.delete_reason && <p><b>{tx('سبب الحذف', 'Deletion reason')}</b> {shopper.delete_reason}</p>}
            </div>
            <div className="admin-review-actions">
              <button className={`outline-btn${shopper.deleted_at ? '' : ' admin-remove-record'}`} type="button" disabled={Boolean(busy)} onClick={() => void changeAccount(shopper)}>
                {shopper.deleted_at ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                {busy === shopper.id ? tx('جارٍ التنفيذ…', 'Working…') : shopper.deleted_at ? tx('استعادة الحساب', 'Restore account') : tx('حذف الحساب', 'Delete account')}
              </button>
            </div>
          </>
        )}
      />
      {deleting && <AdminDeletionDialog locale={locale} names={deleting.map(label)} kind="shopper"
        onCancel={() => setDeleting(null)} onConfirm={() => void deleteShoppers(deleting)} />}
    </section>
  );
}
