'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/catalog';
import { saveSearchSetting, useSearchSettings, type SearchSettings } from '@/lib/search-settings';

export function AdminSearchSettings({ locale }: { locale: Locale }) {
  const {settings, failed} = useSearchSettings();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const t = (ar: string, en: string) => locale === 'ar' ? ar : en;
  async function toggle(key: keyof SearchSettings) {
    if (!settings || saving) return;
    setSaving(true);
    setNotice('');
    try {
      await saveSearchSetting(key, !settings[key]);
      setNotice(t('تم حفظ الإعداد.', 'Setting saved.'));
    } catch { setNotice(t('تعذّر حفظ الإعداد. حاول مرة أخرى.', 'Could not save this setting. Please retry.')); }
    finally { setSaving(false); }
  }
  const controls = [
    { key: 'weekly_limit', label: t('تحديد البحث بخمس مرات أسبوعيًا للمسجّلين', 'Limit signed-in accounts to five searches a week'), detail: t('عند الإيقاف، يصبح البحث بلا حدّ أسبوعي لكل حساب مسجّل.', 'Turn off to give every signed-in account unlimited searches.') },
    { key: 'hide_guest_search', label: t('إخفاء البحث والفلاتر عن الزوار', 'Hide search and filters from guests'), detail: t('عند الإيقاف، يستطيع الزائر البحث والتصفية من الرئيسية قبل تسجيل الدخول.', 'Turn off to let guests search and filter on the homepage before signing in.') },
  ] as const;
  return <section className="admin-panel">
    {failed && <p role="alert">{t('تعذّر تحميل الإعدادات.', 'Could not load settings.')} <button className="outline-btn" onClick={() => window.dispatchEvent(new Event('search-settings-changed'))}>{t('إعادة المحاولة', 'Retry')}</button></p>}
    {!settings && !failed && <p role="status">{t('جارٍ تحميل الإعدادات…', 'Loading settings…')}</p>}
    {settings && controls.map(({key,label,detail}) => <div className="admin-search-control" key={key}>
      <div><strong id={key}>{label}</strong><p id={key + '-detail'}>{detail}</p></div>
      <button type="button" role="switch" aria-labelledby={key} aria-describedby={key + '-detail'} aria-checked={settings[key]} disabled={saving || failed}
        className={settings[key] ? 'primary-btn' : 'outline-btn'} onClick={() => void toggle(key)}>{settings[key] ? t('مفعّل', 'On') : t('متوقف', 'Off')}</button>
    </div>)}
    <p role="status">{notice}</p>
  </section>;
}
