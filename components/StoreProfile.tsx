'use client';

import { ProductLink } from './ProductLink';
import { WhatsAppLink } from './WhatsAppLink';
import { ReportListing } from './ReportListing';
import { PageBrand } from '@/components/PageBrand';
import { DemoNotice } from '@/components/home/HomeSections';
import { CatalogImage } from '@/components/CatalogImage';
import '@/components/home/home.css';
import { useCatalog } from '@/lib/catalog-client';
import type { CatalogData, Locale } from '@/lib/catalog';
import { formatNumber } from '@/lib/number-format';

export function StoreProfile({ locale, slug, initialCatalog = null }: { locale: Locale; slug: string; initialCatalog?: CatalogData | null }) {
  const ar = locale === 'ar';
  const { data: catalog, loading, error } = useCatalog(initialCatalog);
  const isDemo = catalog?.source === 'demo';
  const store = catalog?.stores.find((item) => item.slug === slug);
  const area = store && catalog?.areas.find((item) => item.id === store.areaId);
  const storeProducts = store ? catalog?.products.filter((item) => item.storeId === store.id) ?? [] : [];

  return (
    <>
      <DemoNotice locale={locale} isDemo={isDemo} />
      <div className="store-page" dir={ar ? 'rtl' : 'ltr'}>
        <header className="store-page-header"><PageBrand locale={locale} /><a href={`/${locale}/stores`}>{ar ? 'دليل المحلات' : 'Store directory'}</a></header>
        {loading && <p className="cc-data-message" role="status">{ar ? 'جارٍ تحميل ملف المحل…' : 'Loading store profile…'}</p>}
        {error && <p className="cc-data-message is-error" role="alert">{ar ? 'تعذر تحميل بيانات المحل. حاول تحديث الصفحة.' : 'We could not load this store. Please refresh the page.'}</p>}
        {!loading && !error && !store && <main className="directory"><h1>{ar ? 'لم نعثر على هذا المحل' : 'Store not found'}</h1><a className="visit-button" href={`/${locale}/stores`}>{ar ? 'العودة إلى دليل المحلات' : 'Back to the directory'}</a></main>}
        {store && (
          <div className="store-profile">
            <div className="store-cover"><CatalogImage image={store.image} width={1400} height={933} alt={ar ? store.ar : store.en} loading="eager" priority /></div>
            <div className="store-profile-body"><div><div className="eyebrow dark"><span/> {ar ? 'دليل المحلات' : 'STORE DIRECTORY'}</div><h1>{ar ? store.ar : store.en}</h1><p>{ar ? store.descriptionAr : store.descriptionEn}</p><span>{ar ? `${store.products} قطعة` : `${store.products} pieces`} · {ar ? area?.ar : area?.en}</span><ReportListing key={store.id} id={store.id} kind="store" name={ar ? store.ar : store.en} path={`/${locale}/stores/${store.slug}`} locale={locale} /><p className="store-address">⌖ {ar ? store.addressAr : store.addressEn}</p><WhatsAppLink showUnavailable number={store.whatsapp} locale={locale} />{store.phone ? <p className="store-address"><a href={`tel:${store.phone}`}><b>{ar ? "رقم الهاتف:" : "Phone number:"}</b> <bdi dir="ltr">{store.phone}</bdi></a></p> : isDemo ? <p className="store-address">{ar ? "رقم الهاتف غير متاح في البيانات التجريبية." : "Phone number unavailable."}</p> : null}</div><a className="visit-button" target="_blank" rel="noreferrer" href={store.locationUrl || `https://maps.google.com/?q=${encodeURIComponent(ar ? store.addressAr : store.addressEn)}`} aria-label={ar ? 'موقع المحل' : 'Store location'}>{ar ? 'موقع المحل' : 'Store location'} ↗</a></div>
            <section className="store-products" aria-labelledby="store-products-title"><h2 id="store-products-title">{ar ? 'اختيارات المحل' : 'From this store'}</h2><p>{ar ? 'تأكد من توفر القطعة قبل زيارتك.' : 'Contact the store to confirm availability before visiting.'}</p><div className="simple-product-grid">{storeProducts.map((product) => <div key={product.id} className="simple-product">
              <ProductLink className="product-image-link" href={`/${locale}/products/${product.id}`} aria-label={ar ? `تفاصيل ${product.ar}` : `Details for ${product.en}`}><CatalogImage image={product.image} width={500} height={375} alt={ar ? product.ar : product.en} /></ProductLink>{(product.discountPercent ?? 0) > 0 && <em className="cc-discount-ribbon">{ar ? `خصم ${formatNumber(product.discountPercent ?? 0, locale)}٪` : `${product.discountPercent}% OFF`}</em>}<b>{ar ? product.ar : product.en}</b><span>{(product.discountPercent ?? 0) > 0 ? <><del>{formatNumber(product.price, locale)} {ar ? 'ج.م' : 'EGP'}</del> <strong>{formatNumber(Math.round(product.price * (1 - (product.discountPercent ?? 0) / 100)), locale)} {ar ? 'ج.م' : 'EGP'}</strong></> : <>{formatNumber(product.price, locale)} {ar ? 'ج.م' : 'EGP'}</>} · {product.available ? (ar ? 'متاح حسب آخر تحديث' : 'Available per latest update') : (ar ? 'غير متاح' : 'Unavailable')}</span><WhatsAppLink number={store.whatsapp} locale={locale}/><a className="product-location-link" href={store.locationUrl || `https://maps.google.com/?q=${encodeURIComponent(ar ? store.addressAr : store.addressEn)}`} target="_blank" rel="noreferrer" aria-label={ar ? 'موقع المحل (يفتح في نافذة جديدة)' : 'Store location (opens in new tab)'}>⌖ {ar ? 'موقع المحل' : 'Store location'} ↗</a>
            </div>)}</div>{storeProducts.length === 0 && <p className="cc-data-message">{ar ? 'لم يضف المحل منتجات بعد.' : 'This store has not added products yet.'}</p>}</section>
            {store.offer && <aside className="store-offers"><div><div className="eyebrow dark"><span/> {ar ? 'ميزة إضافية من المحل' : 'OPTIONAL IN-STORE OFFER'}</div><h3>{ar ? store.offer.titleAr : store.offer.titleEn}</h3><p>{ar ? store.offer.descriptionAr : store.offer.descriptionEn}</p></div><code>{store.offer.code}</code></aside>}
          </div>
        )}
      </div>
    </>
  );
}
