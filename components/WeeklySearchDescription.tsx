'use client';

import { useSearchSettings } from '@/lib/search-settings';
import type { Locale } from '@/lib/catalog';

export function WeeklySearchDescription({locale}: {locale: Locale}) {
  const {settings} = useSearchSettings();
  if (!settings) return null;
  if (!settings.weekly_limit) return <p>{locale === 'ar' ? 'البحث متاح حاليًا بلا حدّ أسبوعي للحسابات المسجّلة.' : 'Signed-in accounts currently have unlimited searches.'}</p>;
  return <p>{locale === 'ar' ? 'لك ٥ عمليات بحث أسبوعيًا عند تسجيل الدخول. يتجدد رصيدك كل سبت الساعة ١٢ صباحًا بتوقيت القاهرة.' : 'Signed-in accounts get 5 searches each week. Your balance resets every Saturday at midnight, Cairo time.'}</p>;
}
