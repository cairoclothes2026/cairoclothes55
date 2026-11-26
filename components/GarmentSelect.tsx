import type { Locale } from '@/lib/catalog';
import { attributeLabels, options, type AttributeKey } from '@/lib/garment-attributes';

export function GarmentSelect({ field, locale, value, onChange, filter = false, required = false }: {
  field: AttributeKey; locale: Locale; value: string; onChange: (value: string) => void; filter?: boolean; required?: boolean;
}) {
  return <label className="garment-field">{attributeLabels[field][locale]}
    <select required={required} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{filter ? (locale === 'ar' ? 'الكل' : 'All') : (locale === 'ar' ? 'اختر' : 'Select')}</option>
      {Object.entries(options[field]).map(([code, arabic]) => <option value={code} key={code}>{locale === 'ar' ? arabic : code}</option>)}
    </select>
  </label>;
}
