const UNSPLASH_IMAGE_BASE = 'https://images.unsplash.com/';
export const IMAGE_FALLBACK = '/images/product-placeholder.svg';

export function catalogImageUrl(image: string | null | undefined, width: number) {
  const source = image?.trim();
  if (!source) return IMAGE_FALLBACK;

  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith('//')) return `https:${source}`;
  if (source.startsWith('/')) return source;

  return `${UNSPLASH_IMAGE_BASE}${source.replace(/^\/+/, '')}?auto=format&fit=crop&w=${width}&q=85`;
}
