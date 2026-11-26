import { whatsappNumber } from '@/lib/whatsapp';
import type { Locale } from '@/lib/catalog';

export function WhatsAppLink({ number, locale, compact = false, showUnavailable = false }: { number?: string; locale: Locale; compact?: boolean; showUnavailable?: boolean }) {
  const digits = number && whatsappNumber(number);
  if (!digits && !showUnavailable) return null;
  const ar = locale === 'ar';
  const content = <>
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.9 11.7a9 9 0 0 1-13.4 7.9L3 21l1.4-4.4A9 9 0 1 1 20.9 11.7Z"/><path d="m8.3 7.3 1.2-.1 1 2.4-.9 1.1a7 7 0 0 0 3.5 3.2l1.1-1.3 2.2 1c.6 2.3-1.9 3.2-3.7 2.4-2.8-1.1-6.3-4.1-5.6-7 .2-.8.6-1.4 1.2-1.7Z" fill="currentColor" stroke="none"/></svg>
    <span className={compact ? 'whatsapp-full-label' : undefined}>{ar ? 'راسل المحل على واتساب' : 'Message the store on WhatsApp'}</span>
    {compact && <span className="whatsapp-short-label">{ar ? 'واتساب' : 'WhatsApp'}</span>}
  </>;
  if (!digits) return <div className="cc-whatsapp-unavailable">
    <button className="cc-whatsapp" type="button" disabled>{content}</button>
    <small>{ar ? 'لم يضف المحل رقم واتساب بعد.' : 'The store has not added a WhatsApp number yet.'}</small>
  </div>;
  return <a className="cc-whatsapp" href={'https://wa.me/' + digits} target="_blank" rel="noopener noreferrer">{content}</a>;
}
