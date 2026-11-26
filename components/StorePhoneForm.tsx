'use client';

import { useState, type FormEvent } from 'react';
import { contactInputValue, sharedStoreContact, storeContactNumber } from '@/lib/whatsapp';
import type { Locale } from '@/lib/catalog';

export function StorePhoneForm({ locale, store, onSave }: {
  locale: Locale;
  store: { id: string; whatsapp: string | null; phone: string | null };
  onSave: (storeId: string, phone: string | null) => void;
}) {
  const tx = (ar: string, en: string) => locale === 'ar' ? ar : en;
  const label = tx('رقم الهاتف وواتساب المحل', 'Store phone and WhatsApp number');
  const [phone, setPhone] = useState(contactInputValue(sharedStoreContact(store) ?? store.phone ?? ''));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const value = phone.trim();
    const number = storeContactNumber(value);
    if (value && !number) {
      setNotice({ kind: 'error', text: tx('أدخل رقم هاتف صحيحًا، مثل 01012345678.', 'Enter a valid phone number, for example 01012345678.') });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch('/api/merchant/store-address', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: store.id, phone: number || null }),
      });
      const result = await response.json() as { phone?: string | null };
      if (!response.ok || typeof result.phone === 'undefined') throw new Error('phone_not_saved');
      onSave(store.id, result.phone);
      setPhone(contactInputValue(result.phone ?? ''));
      setNotice({ kind: 'success', text: tx('تم حفظ الرقم.', 'Number saved.') });
    } catch {
      setNotice({ kind: 'error', text: tx('تعذر حفظ رقم الهاتف. تحقق منه وحاول مرة أخرى.', 'Could not save the phone number. Check it and try again.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel merchant-location-panel">
      <div className="panel-heading"><div><h2>{label}</h2><p>{tx('اكتب الرقم المحلي بدءًا بالصفر. يُستخدم للاتصال بالمحل ومراسلته على واتساب. اتركه فارغًا لإزالته.', 'Enter the local number starting with 0. Shoppers can call or message this number on WhatsApp. Leave it empty to remove it.')}</p></div></div>
      <form className="merchant-location-form" onSubmit={save}>
        <label htmlFor={`store-contact-${store.id}`}>{label}</label>
        <div className="store-contact-input" dir="ltr">
          {!/^(?:\+|00)/.test(phone.trim()) && <span aria-hidden="true">+2</span>}
          <input id={`store-contact-${store.id}`} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={30} placeholder="01012345678" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={saving}/>
        </div>
        <button className="primary-btn" type="submit" disabled={saving}>{saving ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ الرقم', 'Save number')}</button>
        {notice && <p className={`admin-state is-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
      </form>
    </section>
  );
}
