'use client';

import { WhatsAppLink } from './WhatsAppLink';
import { ReportListing } from './ReportListing';
import { PageBrand } from '@/components/PageBrand';
import { CatalogImage } from '@/components/CatalogImage';
import { DemoNotice } from '@/components/home/HomeSections';
import '@/components/home/home.css';
import type { CatalogData, Locale } from '@/lib/catalog';
import { formatNumber } from '@/lib/number-format';

export function ProductProfile({ locale, id, initialCatalog = null }: { locale: Locale; id: string; initialCatalog?: CatalogData | null }) {
  const ar = locale === 'ar';
  const catalog = initialCatalog;
  const isDemo = catalog?.source === 'demo';
  const product = catalog?.products.find((item) => item.id === id);
  const store = product && catalog?.stores.find((item) => item.id === product.storeId);
  const area = store && catalog?.areas.find((item) => item.id === store.areaId);
  const discount = Number(product?.discountPercent ?? 0);
  const currentPrice = product ? Math.round(product.price * (1 - discount / 100)) : 0;
  const name = product && (ar ? product.ar : product.en);
  const description = product && (ar ? product.descriptionAr : product.descriptionEn);
  const address = store ? (ar ? store.addressAr : store.addressEn) : '';
  const locationUrl = store ? (store.locationUrl || `https://maps.google.com/?q=${encodeURIComponent(address)}`) : undefined;
  const category = product && (ar
    ? product.category === 'men' ? 'ملابس رجالي' : product.category === 'women' ? 'ملابس نسائي' : 'ملابس أطفال'
    : product.category === 'men' ? 'Menswear' : product.category === 'women' ? 'Womenswear' : 'Kidswear');

  return (
    <>
      <DemoNotice locale={locale} isDemo={isDemo} />
      <div className="store-page product-profile-page" dir={ar ? 'rtl' : 'ltr'}>
        <header className="store-page-header">
          <PageBrand locale={locale} />
          <a href={`/${locale}/stores`}>{ar ? 'دليل المحلات' : 'Store directory'}</a>
        </header>

        {!catalog && <p className="cc-data-message is-error" role="alert">{ar ? 'تعذر تحميل المنتج. حاول تحديث الصفحة.' : 'We could not load this product. Please refresh the page.'}</p>}
        {catalog && (!product || !store) && (
          <main className="directory">
            <h1>{ar ? 'لم نعثر على هذا المنتج' : 'Product not found'}</h1>
            <a className="visit-button" href={`/${locale}/stores`}>{ar ? 'العودة إلى دليل المحلات' : 'Back to the store directory'}</a>
          </main>
        )}

        {product && store && name && locationUrl && (
          <main className="cc-product-page">
            <a className="cc-product-back" href={`/${locale}/stores/${store.slug}`}>← {ar ? `العودة إلى ${store.ar}` : `Back to ${store.en}`}</a>
            <article className="cc-product-detail">
              <figure className="cc-product-detail-photo">
                <CatalogImage image={product.image} width={1000} height={750} alt={name} loading="eager" priority />
                {discount > 0 && <span className="cc-discount-ribbon" aria-label={ar ? `خصم ${formatNumber(discount, locale)}٪` : `${discount}% OFF`}>{ar ? `خصم ${formatNumber(discount, locale)}٪` : `${discount}% OFF`}</span>}
              </figure>
              <section className="cc-product-detail-info">
                <p className="cc-product-category">{category}</p>
                <h1>{name}</h1>
                {description && <p className="cc-product-description">{description}</p>}

                <div className="cc-product-detail-price">
                  {discount > 0 && <del>{formatNumber(product.price, locale)} {ar ? 'ج.م' : 'EGP'}</del>}
                  <strong>{formatNumber(currentPrice, locale)} {ar ? 'ج.م' : 'EGP'}</strong>
                </div>

                <div className="cc-product-detail-section">
                  <h2>{ar ? 'المقاسات المتاحة' : 'Available sizes'}</h2>
                  {product.sizes.length > 0
                    ? <div className="cc-product-sizes">{product.sizes.map((size) => <span key={size}>{size}</span>)}</div>
                    : <p>{ar ? 'لم يحدد المحل المقاسات.' : 'The store has not listed sizes.'}</p>}
                </div>

                {product.updatedAt && <p>{ar ? 'آخر تحديث لهذه القطعة' : 'Last updated for this item'} · <time dateTime={product.updatedAt}>{new Intl.DateTimeFormat(locale, { timeZone: 'Africa/Cairo', dateStyle: 'long', timeStyle: 'short' }).format(new Date(product.updatedAt))}</time> ({ar ? 'توقيت القاهرة' : 'Cairo time'})</p>}
                <p className={`cc-product-availability ${product.available ? 'is-available' : 'is-unavailable'}`}>
                  {product.available ? (ar ? 'متاح حسب آخر تحديث' : 'Available per latest update') : (ar ? 'غير متاح حاليًا' : 'Currently unavailable')}
                </p>

                <div className="cc-product-store">
                  <h2>{ar ? 'المحل' : 'Store'}</h2>
                  <b>{ar ? store.ar : store.en}</b>
                  <p>{[area && (ar ? area.ar : area.en), address].filter(Boolean).join(' · ')}</p>
                  <div className="cc-product-store-actions"><WhatsAppLink showUnavailable number={store.whatsapp} locale={locale} />
                    <a className="visit-button" href={locationUrl} target="_blank" rel="noreferrer" aria-label={ar ? 'موقع المحل (يفتح في نافذة جديدة)' : 'Store location (opens in new tab)'}>⌖ {ar ? 'موقع المحل' : 'Store location'} ↗</a>
                    <a className="cc-product-store-link" href={`/${locale}/stores/${store.slug}`}>{ar ? 'صفحة المحل' : 'Store page'} →</a>
                  </div>
                </div>
                <ReportListing key={product.id} id={product.id} kind="product" name={name} path={`/${locale}/products/${product.id}`} locale={locale} />
              </section>
            </article>
          </main>
        )}
      </div>
    </>
  );
}
