'use client';

import { useEffect } from 'react';

/** The root layout is locale-agnostic, so keep <html lang/dir> in sync with the active route. */
export function LocaleHtmlAttrs({ locale }: { locale: 'ar' | 'en' }) {
  useEffect(() => {
    const root = document.documentElement;
    root.lang = `${locale}-u-nu-latn`;
    root.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);
  return null;
}
