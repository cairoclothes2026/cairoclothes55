'use client';

import { homePath } from '@/lib/home-path';

import { DemoNotice } from '@/components/home/HomeSections';
import { PageBrand } from '@/components/PageBrand';
import { CatalogImage } from '@/components/CatalogImage';
import '@/components/home/home.css';
import { useCatalog } from '@/lib/catalog-client';
import type { CatalogData, Locale } from '@/lib/catalog';

export function StoreDirectory({ locale, initialCatalog = null }: { locale: Locale; initialCatalog?: CatalogData | null }) {
  const ar = locale === 'ar';
  const { data: catalog, loading, error } = useCatalog(initialCatalog);
  const isDemo = catalog?.source === 'demo';
  const areas = catalog?.areas ?? [];
  const stores = catalog?.stores ?? [];

  return (
    <>
      <DemoNotice locale={locale} isDemo={isDemo} />
      <main className="directory" dir={ar ? 'rtl' : 'ltr'}>
        <header className="cc-catalog-header"><PageBrand locale={locale} /></header>
        <a className="back-home" href={homePath(locale)} aria-label={ar ? 'العودة للاكتشاف' : 'Back to discovery'}>← {ar ? 'العودة للاكتشاف' : 'Back to discovery'}</a>
        <div className="eyebrow dark"><span/> {ar ? 'دليل القاهرة' : 'CAIRO DIRECTORY'}</div>
        <h1>{ar ? 'محلات تستحق الاكتشاف' : 'Stores worth discovering'}</h1>
        {loading && <p className="cc-data-message" role="status">{ar ? 'جارٍ تحميل المحلات…' : 'Loading stores…'}</p>}
        {error && <p className="cc-data-message is-error" role="alert">{ar ? 'تعذر تحميل المحلات من قاعدة البيانات. حاول تحديث الصفحة.' : 'We could not load stores from the database. Please refresh the page.'}</p>}
        {!loading && !error && stores.length === 0 && <p className="cc-data-message">{ar ? 'لا توجد محلات منشورة حاليًا.' : 'There are no published stores yet.'}</p>}
        <div className="directory-grid">
          {stores.map((store) => {
            const area = areas.find((item) => item.id === store.areaId);
            return (
              <a key={store.id} href={`/${locale}/stores/${store.slug}`} className="directory-card">
                <CatalogImage image={store.image} width={800} height={600} alt={ar ? store.ar : store.en} />
                <div>
                  <span>{ar ? area?.ar : area?.en}</span>
                  <h2>{ar ? store.ar : store.en}</h2>
                  <p>{ar ? store.descriptionAr : store.descriptionEn}</p>
                  <b>{store.products} {ar ? 'قطعة' : 'pieces'} ↗</b>
                </div>
              </a>
            );
          })}
        </div>
      </main>
    </>
  );
}
