'use client';

import type { Locale } from '@/lib/catalog';
import { legalUrl } from '@/lib/legal';

export function LegalConsentControl({ locale, accountType, checked, onChange, required = true }: {
  locale: Locale;
  accountType: 'customer' | 'merchant';
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
}) {
  const ar = locale === 'ar';
  return <label className="legal-consent-control">
    <input type="checkbox" required={required} checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span>{ar ? 'أوافق على ' : 'I agree to the '}
      <a href={legalUrl(locale, 'terms')} target="_blank" rel="noreferrer">{ar ? 'الشروط والأحكام' : 'Terms'}</a>
      {accountType === 'merchant' && <>{ar ? ' و' : ', the '}
        <a href={legalUrl(locale, 'merchant-agreement')} target="_blank" rel="noreferrer">{ar ? 'اتفاقية المحلات' : 'Merchant Agreement'}</a>
        {ar ? ' و' : ', and the '}
        <a href={legalUrl(locale, 'product-policy')} target="_blank" rel="noreferrer">{ar ? 'سياسة المنتجات' : 'Product Policy'}</a>
      </>}
      {ar ? '، وأقر بالاطلاع على ' : ', and I acknowledge the '}
      <a href={legalUrl(locale, 'privacy')} target="_blank" rel="noreferrer">{ar ? 'إشعار الخصوصية' : 'Privacy Notice'}</a>.
    </span>
  </label>;
}
