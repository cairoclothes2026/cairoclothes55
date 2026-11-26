import type { Locale } from '@/lib/catalog';

export function homePath(locale: Locale) {
  return locale === 'ar' ? '/' : '/en';
}
