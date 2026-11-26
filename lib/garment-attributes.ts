import type { Locale } from './catalog';

export const attributeKeys = ['piece_type', 'color', 'pattern', 'fabric'] as const;
export type AttributeKey = typeof attributeKeys[number];
export type Attributes = Record<AttributeKey, string>;
export const emptyAttributes: Attributes = { piece_type: '', color: '', pattern: '', fabric: '' };
export const attributeLabels: Record<AttributeKey, Record<Locale, string>> = {
  piece_type: { ar: 'نوع القطعة', en: 'Garment type' },
  color: { ar: 'اللون', en: 'Colour' },
  pattern: { ar: 'النقشة', en: 'Pattern' },
  fabric: { ar: 'الخامة', en: 'Fabric' },
};
export const options: Record<AttributeKey, Record<string, string>> = {
  piece_type: {
    'T-shirt': 'تيشيرت',
    'Shirt': 'قميص',
    'Polo': 'بولو',
    'Blouse': 'بلوزة',
    'Top': 'توب',
    'Trousers': 'بنطلون',
    'Jeans': 'جينز',
    'Shorts': 'شورت',
    'Skirt': 'تنورة',
    'Dress': 'فستان',
    'Sweatshirt': 'سويت شيرت',
    'Hoodie': 'هودي',
    'Sweater': 'بلوفر',
    'Cardigan': 'كارديجان',
    'Jacket': 'جاكيت',
    'Blazer': 'بليزر',
    'Coat': 'معطف',
    'Suit': 'بدلة',
    'Set': 'طقم',
    'Abaya': 'عباية',
    'Pyjamas': 'بيجامة',
    'Sportswear': 'ملابس رياضية',
    'Other': 'أخرى',
  },
  color: {
    'Black': 'أسود',
    'White': 'أبيض',
    'Navy': 'كحلي',
    'Blue': 'أزرق',
    'Sky blue': 'سماوي',
    'Grey': 'رمادي',
    'Beige': 'بيج',
    'Ivory': 'عاجي',
    'Brown': 'بني',
    'Burgundy': 'نبيتي',
    'Red': 'أحمر',
    'Pink': 'وردي',
    'Purple': 'بنفسجي',
    'Green': 'أخضر',
    'Olive': 'زيتي',
    'Yellow': 'أصفر',
    'Orange': 'برتقالي',
    'Gold': 'ذهبي',
    'Silver': 'فضي',
    'Multicolour': 'متعدد الألوان',
    'Other': 'أخرى',
  },
  pattern: {
    'Solid': 'سادة',
    'Striped': 'مخطط',
    'Checked': 'كاروهات',
    'Graphic': 'برسمة',
    'Floral': 'زهور',
    'Polka dot': 'منقط',
    'Geometric': 'نقشة هندسية',
    'Camouflage': 'مموّه',
    'Embroidered': 'مطرّز',
    'Other': 'أخرى',
  },
  fabric: {
    'Cotton': 'قطن',
    'Linen': 'كتان',
    'Denim': 'دنيم',
    'Wool': 'صوف',
    'Silk': 'حرير',
    'Satin': 'ساتان',
    'Chiffon': 'شيفون',
    'Polyester': 'بوليستر',
    'Viscose': 'فيسكوز',
    'Nylon': 'نايلون',
    'Leather': 'جلد',
    'Faux leather': 'جلد صناعي',
    'Velvet': 'قطيفة',
    'Blend': 'خليط أقمشة',
    'Other': 'أخرى',
  },
};

export function describeAttributes(values: Attributes, locale: Locale) {
  return attributeKeys.filter(key => values[key]).map(key => locale === 'ar' ? options[key][values[key]] : values[key]).join(' · ');
}

// Older listings have names but no merchant-selected attributes. Use only words
// supplied in the listing, and always prefer explicitly recorded attributes.
const garmentAliases: [string, RegExp][] = [
  ['Jacket', /\bjacket\b/], ['Polo', /\bpolo\b/], ['T-shirt', /\bt[ -]?shirt\b/],
  ['Jeans', /\bjeans\b/], ['Trousers', /\bpants\b/], ['Shorts', /\bshorts?\b/],
  ['Shirt', /\b(?:shirt|shrit)\b/],
];

export function matchesAttributes(product: import('./catalog').Product, selected: Attributes) {
  const name = product.en.toLowerCase();
  const words = ' ' + name.replace(/[^a-z]+/g, ' ').trim() + ' ';
  return attributeKeys.every(key => {
    const wanted = selected[key];
    if (!wanted) return true;
    if (key === 'color' && product.colors?.length) return product.colors.includes(wanted);
    if (key !== 'color' && product[key]) return product[key] === wanted;
    if (key === 'piece_type') {
      const kind = garmentAliases.find(([, expression]) => expression.test(name));
      if (kind) return kind[0] === wanted;
    }
    if (key === 'pattern' && wanted === 'Striped' && /\b(?:stripes|striped|strpes)\b/.test(name)) return true;
    if (key === 'color' && wanted === 'Grey' && words.includes(' gray ')) return true;
    return words.includes(' ' + wanted.toLowerCase() + ' ');
  });
}
