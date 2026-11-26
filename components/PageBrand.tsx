import { homePath } from '@/lib/home-path';
import type { Locale } from '@/lib/catalog';

export function PageBrand({ locale, subtitle }: { locale: Locale; subtitle?: string }) {
  return (
    <a className="brand brand-page" href={homePath(locale)} aria-label="CAIRO CLOTHES">
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-copy">
        <span className="cc-wordmark" dir="ltr" lang="en">CAIRO CLOTHES</span>
        <small>{subtitle ?? (locale === 'ar' ? 'العالم أقرب مما تتخيل' : 'Discover local. Choose well.')}</small>
      </span>
    </a>
  );
}
