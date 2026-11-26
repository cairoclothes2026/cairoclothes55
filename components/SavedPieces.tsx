'use client';

import { sharedStoreContact } from '@/lib/whatsapp';
import { WhatsAppLink } from './WhatsAppLink';
import { ProductLink } from './ProductLink';
import { X } from 'lucide-react';
import { CatalogImage } from '@/components/CatalogImage';
import type { Locale } from '@/lib/catalog';
import { filterDemoProducts } from '@/lib/demo-filter';
import { formatNumber } from '@/lib/number-format';
import { useSavedPieces } from '@/lib/use-saved-pieces';

export function SavedPieces({ locale, profileId }: { locale: Locale; profileId: string }) {
  const ar = locale === 'ar';
  const { pieces, loading, loadError, writeError, pendingId, retry, setSaved } = useSavedPieces(profileId);

  return (
    <section className="account-saved-pieces" id="saved-pieces" aria-labelledby="saved-pieces-title">
      <h1 id="saved-pieces-title">{ar ? 'مفضلاتي' : 'My favorites'}</h1>
      {loading && <p role="status">{ar ? 'جارٍ تحميل القطع المحفوظة…' : 'Loading saved pieces…'}</p>}
      {loadError && (
        <div className="onboarding-message error" role="alert">
          {ar ? 'تعذر تحميل القطع المحفوظة.' : 'Could not load your saved pieces.'}
          <button type="button" className="onboarding-text-button" onClick={retry}>{ar ? 'إعادة المحاولة' : 'Retry'}</button>
        </div>
      )}
      {writeError && <p className="onboarding-message error" role="alert">{ar ? 'تعذر إزالة القطعة. حاول مرة أخرى.' : 'Could not remove the item. Try again.'}</p>}
      {!loading && !loadError && pieces.length === 0 && (
        <div className="account-saved-empty">
          <p>{ar ? 'لم تحفظ أي قطعة بعد. اضغط على القلب بجانب أي قطعة تعجبك.' : 'No saved pieces yet. Tap the heart on any item you like.'}</p>
        </div>
      )}
      {pieces.length > 0 && (
        <ul className="account-saved-list">
          {pieces.map(({ product_id: id, product }) => {
            const visible = product && filterDemoProducts([product]).length > 0 ? product : null;
            const name = visible ? (ar ? visible.name_ar : visible.name_en) : (ar ? 'قطعة لم تعد متاحة' : 'Item no longer available');
            const price = visible ? Number(visible.price_egp) * (1 - Number(visible.discount_percent ?? 0) / 100) : 0;
            return (
              <li key={id}>
                {visible ? (
                  <ProductLink href={'/' + locale + '/products/' + id}>
                    <CatalogImage image={visible.images?.[0]} alt="" width={80} height={96} sizes="72px" />
                    <span><strong>{name}</strong><small><bdi>{formatNumber(Math.round(price * 100) / 100, locale)} {ar ? 'ج.م' : 'EGP'}</bdi></small></span>
                  </ProductLink>
                ) : <span className="account-saved-unavailable">{name}</span>}
                <WhatsAppLink compact number={sharedStoreContact(visible?.store)} locale={locale}/>
                <button type="button" disabled={Boolean(pendingId)} onClick={() => void setSaved(id, false)} aria-label={ar ? 'إزالة ' + name : 'Remove ' + name}>
                  <X size={18} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
