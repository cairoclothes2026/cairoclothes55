import { homePath } from '@/lib/home-path';
import type { Locale } from '@/lib/catalog';

export function CategoryEmptyState({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';

  return (
    <div className="cc-category-empty">
      <span className="cc-category-empty-icon" aria-hidden="true">C</span>
      <p>
        {ar
          ? 'لا توجد قطع منشورة في هذه الفئة حتى الآن. استكشف القطع المتاحة أو ابحث عن محل قريب.'
          : 'There are no items in this category yet. Explore the pieces currently available or find a nearby store.'}
      </p>
      <div className="cc-category-empty-links">
        <a href={homePath(locale) + '#discover'}>{ar ? 'استكشف القطع المتاحة' : 'Explore available pieces'}</a>
        <a href={'/' + locale + '/stores'}>{ar ? 'تصفح المحلات' : 'Browse stores'}</a>
      </div>
    </div>
  );
}