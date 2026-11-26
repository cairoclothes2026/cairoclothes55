import type { Locale } from './catalog';

/** Keep Western (0–9) digits in every language while retaining locale grouping. */
export function numberLocale(locale: Locale) {
  return locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US-u-nu-latn';
}

export function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(numberLocale(locale)).format(value);
}

export function formatDate(value: string, locale: Locale) {
  const dateLocale = locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn';
  return new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium' }).format(new Date(value));
}
