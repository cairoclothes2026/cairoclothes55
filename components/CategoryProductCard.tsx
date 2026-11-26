import { ProductLink } from './ProductLink';
import { WhatsAppLink } from './WhatsAppLink';
import { CatalogImage } from '@/components/CatalogImage';
import type { Area, Locale, Product, Store } from '@/lib/catalog';
import { formatNumber } from '@/lib/number-format';

type Props = {
  product: Product;
  locale: Locale;
  stores: Store[];
  areas: Area[];
};

export function CategoryProductCard({ product, locale, stores, areas }: Props) {
  const ar = locale === 'ar';
  const store = stores.find((item) => item.id === product.storeId);
  const area = areas.find((item) => item.id === store?.areaId);
  const discount = product.discountPercent ?? 0;
  const price = discount > 0
    ? Math.round(product.price * (1 - discount / 100))
    : product.price;
  const currency = ar ? 'ج.م' : 'EGP';

  return (
    <article className="cc-product-card">
      <ProductLink className="cc-category-product-link" href={'/' + locale + '/products/' + product.id}>
        <div className="cc-category-card-media">
          <CatalogImage
            image={product.image}
            width={600}
            height={750}
            alt={ar ? product.ar : product.en}
            sizes="(max-width: 680px) 50vw, (max-width: 1000px) 33vw, 25vw"
          />
          {discount > 0 && (
            <span className="cc-category-discount">
              {ar ? 'خصم ' + formatNumber(discount, locale) + '٪' : formatNumber(discount, locale) + '% OFF'}
            </span>
          )}
        </div>
        <div className="cc-category-card-body">
          <h2>{ar ? product.ar : product.en}</h2>
          <p className="cc-category-product-price">
            {discount > 0 && (
              <del><bdi dir="ltr">{formatNumber(product.price, locale)} {currency}</bdi></del>
            )}
            <strong><bdi dir="ltr">{formatNumber(price, locale)} {currency}</bdi></strong>
          </p>
        </div>
      </ProductLink>
      {store && (
        <a className="cc-category-store-link" href={'/' + locale + '/stores/' + store.slug}>
          <span>{ar ? store.ar : store.en}</span>
          {area && <small>{ar ? area.ar : area.en}</small>}
        </a>
      )}
    <WhatsAppLink number={store?.whatsapp} locale={locale} /></article>
  );
}