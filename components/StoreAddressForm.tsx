'use client';

import { useState, type FormEvent } from 'react';
import type { Locale } from '@/lib/catalog';

type StoreAddresses = { address_ar: string; address_en: string };

export function StoreAddressForm({ locale, store, onSave }: {
  locale: Locale;
  store: StoreAddresses & { id: string };
  onSave: (storeId: string, addresses: StoreAddresses) => void;
}) {
  const tx = (ar: string, en: string) => locale === 'ar' ? ar : en;
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = new FormData(event.currentTarget);
    const addressAr = String(fields.get('address_ar') ?? '').trim();
    const addressEn = String(fields.get('address_en') ?? '').trim();
    const changes = {
      address_ar: addressAr && addressAr !== store.address_ar.trim() ? addressAr : undefined,
      address_en: addressEn && addressEn !== store.address_en.trim() ? addressEn : undefined,
    };
    if (!changes.address_ar && !changes.address_en) {
      setNotice({ kind: 'error', text: tx('أدخل عنوانًا جديدًا في إحدى الخانتين على الأقل.', 'Enter a new address in at least one field.') });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch('/api/merchant/store-address', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: store.id, ...changes }),
      });
      if (!response.ok) throw new Error('address_not_saved');
      const addresses = await response.json() as StoreAddresses;
      onSave(store.id, addresses);
      setNotice({ kind: 'success', text: tx('تم حفظ عنوان المحل.', 'Store address saved.') });
    } catch {
      setNotice({ kind: 'error', text: tx('تعذر حفظ عنوان المحل. حاول مرة أخرى.', 'Could not save the store address. Try again.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <div>
          <h2>{tx('عنوان المحل', 'Store address')}</h2>
          <p>{tx('عدّل العنوان المكتوب في صفحة المحل. اترك إحدى الخانتين فارغة للاحتفاظ بعنوانها الحالي.', 'Edit the address shown on the store page. Leave either field blank to keep its current address.')}</p>
        </div>
      </div>
      <form className="merchant-location-form" key={JSON.stringify([store.address_ar, store.address_en])} onSubmit={save}>
        <label htmlFor="store-address-ar">{tx('العنوان بالعربية', 'Address in Arabic')}</label>
        <input id="store-address-ar" name="address_ar" dir="rtl" maxLength={240} defaultValue={store.address_ar} disabled={saving}/>
        <label htmlFor="store-address-en">{tx('العنوان بالإنجليزية', 'Address in English')}</label>
        <input id="store-address-en" name="address_en" dir="ltr" maxLength={240} defaultValue={store.address_en} disabled={saving}/>
        <button className="primary-btn" type="submit" disabled={saving}>{saving ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ العنوان', 'Save address')}</button>
        {notice && <p className={`admin-state is-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
      </form>
    </section>
  );
}
