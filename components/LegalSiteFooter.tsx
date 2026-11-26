'use client';

import { usePathname } from 'next/navigation';
import { LEGAL_DOCUMENTS, legalUrl, type LegalDocumentId } from '@/lib/legal';
import type { Locale } from '@/lib/catalog';

const documentIds: LegalDocumentId[] = ['terms', 'privacy', 'merchant-agreement', 'product-policy'];

export function LegalSiteFooter({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const pathname = usePathname()?.replace(/\/+$/, '') || '/';

  if (pathname === '/ar' || pathname === '/en') return null;

  return (
    <footer className="cc-legal-site-footer" dir={ar ? 'rtl' : 'ltr'}>
      <div className="cc-legal-site-footer-inner">
        <h2>{ar ? 'المعلومات القانونية' : 'Legal information'}</h2>
        <nav aria-label={ar ? 'الصفحات القانونية' : 'Legal pages'}>
          {documentIds.map((id) => (
            <a key={id} href={legalUrl(locale, id)}>{LEGAL_DOCUMENTS[id].title[locale]}</a>
          ))}
        </nav>
        <p>{ar ? '© 2026 CAIRO CLOTHES · جميع الحقوق محفوظة' : '© 2026 CAIRO CLOTHES · All rights reserved'}</p>
      </div>
    </footer>
  );
}
