'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '@/lib/catalog';

type Props = {
  locale: Locale;
  names: string[];
  kind: 'shopper' | 'store';
  onCancel: () => void;
  onConfirm: () => void;
};

export function AdminDeletionDialog({ locale, names, kind, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const warningId = useId();
  const [input, setInput] = useState('');
  const tx = (ar: string, en: string) => locale === 'ar' ? ar : en;
  const word = tx('حذف', 'DELETE');
  const confirmed = input.trim() === word;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog ref={dialog} className="admin-deletion-dialog" aria-labelledby={titleId} aria-describedby={warningId}
      onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (confirmed) onConfirm();
      }}>
        <h2 id={titleId}>{tx('تفاصيل الحذف النهائي', 'Permanent deletion details')}</h2>
        <p>{tx('السجلات المحددة', 'Selected records')}</p>
        <ul>{names.map((name, index) => <li key={index}><bdi>{name}</bdi></li>)}</ul>
        <h3>{tx('ما سيُحذف', 'What will be deleted')}</h3>
        <ul>
          {kind === 'store' ? <>
            <li>{tx('المحلات المحددة وطلباتها ومنتجاتها وصورها وعضوياتها.', 'The selected stores, their applications, products, images, and memberships.')}</li>
            <li>{tx('حساب المالك داخل الموقع وبيانات دخوله، بما فيها صلاحية إدارة المحلات الأخرى.', 'The owner’s site account and sign-in details, including its access to manage other stores.')}</li>
          </> : <>
            <li>{tx('حساب المتسوق في الموقع وبياناته ومفضلته.', 'The shopper’s site account, details, and favorites.')}</li>
            <li>{tx('جلسات الدخول وارتباط طرق تسجيل الدخول بهذا الحساب.', 'Sign-in sessions and login methods linked to this site account.')}</li>
          </>}
        </ul>
        <h3>{tx('ما سيبقى', 'What will stay')}</h3>
        <ul>
          <li>{tx('المحلات والحسابات الأخرى خارج نطاق الحذف.', 'Other stores and accounts outside the deletion.')}</li>
          {kind === 'store' && <li>{tx('بيانات ومنتجات المحلات الأخرى. قد يلزم تعيين مالك جديد لها.', 'Other stores’ data and products. They may need a new owner.')}</li>}
          <li>{tx('حسابات Google وFacebook الأصلية خارج الموقع.', 'The original Google and Facebook accounts outside the site.')}</li>
        </ul>
        <p id={warningId}>{tx('لا يمكن استعادة السجل بعد هذا الحذف.', 'The deleted record cannot be restored.')}</p>
        <label>
          {tx(`اكتب «${word}» للتأكيد`, `Type ${word} to confirm`)}
          <input value={input} onChange={(event) => setInput(event.target.value)} autoComplete="off" spellCheck={false} dir="auto" />
        </label>
        <div className="admin-review-actions">
          <button className="outline-btn" type="button" onClick={onCancel}>{tx('إلغاء', 'Cancel')}</button>
          <button className="primary-btn admin-deletion-submit" type="submit" disabled={!confirmed}>
            {tx('تأكيد الحذف النهائي', 'Confirm permanent deletion')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
