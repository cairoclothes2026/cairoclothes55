export function whatsappNumber(value: string) {
  let digits = value.trim().replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[\s().-]/g, '');
  if (/^01[0125]\d{8}$/.test(digits)) digits = '20' + digits.slice(1);
  digits = digits.replace(/^(?:\+|00)/, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
}

export function storeContactNumber(value: string) {
  const digits = value.trim()
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776))
    .replace(/[\s().-]/g, '');
  const international = /^(?:\+|00)/.test(digits);
  const number = digits.replace(/^(?:\+|00)/, '');
  if (international && !number.startsWith('20')) {
    return /^[1-9]\d{7,14}$/.test(number) ? '+' + number : '';
  }
  const national = number.startsWith('20') ? number.slice(2) : number.replace(/^0/, '');
  return /^(?:1[0125]\d{8}|[2-9]\d{7,8})$/.test(national) ? '+20' + national : '';
}

export function sharedStoreContact(store?: { whatsapp?: string | null; phone?: string | null } | null) {
  const whatsapp = whatsappNumber(store?.whatsapp ?? '');
  return (whatsapp && '+' + whatsapp) || storeContactNumber(store?.phone ?? '') || undefined;
}

export function contactInputValue(number: string) {
  return number.startsWith('+20') ? number.slice(2) : number;
}
