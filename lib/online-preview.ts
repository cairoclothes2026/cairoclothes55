import type { Locale } from './catalog';

export type PreviewName = Record<Locale, string>;
export type PreviewItem = { id: string; name: PreviewName; price: number; image: string };
export type PreviewShop = { id: string; name: PreviewName; items: PreviewItem[] };
export type PreviewOrder = {
  id: string; shopId: string; shop: PreviewName; item: PreviewName; quantity: number;
  unitPrice: number; size: string; date: string; confirmed: boolean;
};
export type PreviewState = { shops: PreviewShop[]; orders: PreviewOrder[] };
export const initialPreview: PreviewState = {
  shops: [
    { id: 'studio', name: { ar: 'استوديو وسط البلد', en: 'Downtown Studio' }, items: [
      { id: 'blazer', name: { ar: 'بليزر كحلي', en: 'Navy blazer' }, price: 1250, image: '/images/category-men.webp' },
      { id: 'burgundy', name: { ar: 'بليزر نبيتي', en: 'Burgundy blazer' }, price: 1150, image: '/images/category-women.webp' }
    ] },
    { id: 'junior', name: { ar: 'خطوة صغيرة', en: 'Little Steps' }, items: [
      { id: 'cardigan', name: { ar: 'كارديجان أطفال', en: 'Kids’ cardigan' }, price: 450, image: '/images/category-kids.webp' }
    ] }
  ],
  orders: []
};
const key = 'cc-online-preview-v1';
let cachedValue: string | null = null;
let cachedData = initialPreview;

export function loadPreview(): PreviewState {
  try {
    const value = window.sessionStorage.getItem(key);
    if (value !== cachedValue) {
      cachedData = value ? JSON.parse(value) as PreviewState : initialPreview;
      cachedValue = value;
    }
    return cachedData;
  } catch {
    return initialPreview;
  }
}

export function subscribePreview(notify: () => void) {
  window.addEventListener(key, notify);
  return () => window.removeEventListener(key, notify);
}

export function storePreview(value: PreviewState) {
  window.sessionStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(key));
}
