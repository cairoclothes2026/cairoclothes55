import { CompareScale } from '@/components/CompareScale';
import { ArrowUpLeft, ArrowUpRight, CalendarCheck, MapPin, MessageCircle, Search, Store as StoreIcon, Footprints, Info } from 'lucide-react';
import Image from 'next/image';
import { homePath } from '@/lib/home-path';
import { t, type Locale } from '@/lib/catalog';
import { LEGAL_DOCUMENTS, legalUrl, type LegalDocumentId } from '@/lib/legal';

const footerLegalLinks: LegalDocumentId[] = ['terms', 'privacy', 'merchant-agreement', 'product-policy'];

/** Arrow that points "forward" in both reading directions. */
export function GoIcon({ locale, size = 16 }: { locale: Locale; size?: number }) {
  return locale === 'ar' ? <ArrowUpLeft size={size} aria-hidden="true" /> : <ArrowUpRight size={size} aria-hidden="true" />;
}

export function Brand({ locale, light = false }: { locale: Locale; light?: boolean }) {
  return (
    <a className={`cc-brand ${light ? 'cc-brand-light' : ''}`} href={homePath(locale)} aria-label="CAIRO CLOTHES">
      <span className="cc-brand-mark" aria-hidden="true" />
      <span className="cc-brand-text" dir="ltr">
        <span className="cc-wordmark">CAIRO CLOTHES</span>
        <small className="cc-brand-tagline">{locale === 'ar' ? 'العالم أقرب مما تتخيل' : 'THE WORLD IS CLOSER'}</small>
      </span>
    </a>
  );
}

export function DemoNotice({ locale, isDemo = true }: { locale: Locale; isDemo?: boolean }) {
  if (!isDemo) return null;
  return (
    <div className="cc-demo" role="note">
      <Info size={15} aria-hidden="true" />
      <span>
        {t(locale,
          'نسخة تجريبية.',
          'Demo version.')}
      </span>
    </div>
  );
}

export function Hero({ locale }: { locale: Locale }) {
  return (
    <section className="cc-hero" aria-labelledby="hero-title">
      <div className="cc-hero-copy">
        <p id={locale === 'en' ? 'hero-welcome' : undefined} className="cc-eyebrow"><span aria-hidden="true" />{locale === 'ar' ? 'مرحبًا بك في' : <><span className="cc-hero-desktop-copy">Welcome to</span><span className="cc-hero-mobile-copy">The largest clothing shopping platform.</span></>}</p>
        <h1 id="hero-title"><bdi className="cc-wordmark cc-hero-wordmark" dir="ltr" lang="en">CAIRO CLOTHES</bdi><span className="cc-hero-title-detail">{locale === 'ar' ? 'عالم من الأناقة والاختيار فيه تبدأ رحلتك نحو إطلالة مميزة' : 'In a world of elegance and choice, your journey to a distinctive look begins.'}</span></h1>
        <p className="cc-hero-lead">
          {locale === 'ar' ? 'جميع محلات الملابس في مكان واحد' : <><span className="cc-hero-desktop-copy">All clothing stores in one place</span><span className="cc-hero-mobile-copy"><bdi className="cc-wordmark" dir="ltr" lang="en">CAIRO CLOTHES</bdi> is your favorite destination.</span></>}
        </p>
        <div className="cc-hero-actions">
          <a className="cc-btn cc-btn-primary" href="#discover">{locale === 'ar' ? 'ابدأ البحث' : <><span className="cc-hero-desktop-copy">Start searching</span><span className="cc-hero-mobile-copy">Start exploring</span></>}<GoIcon locale={locale} /></a>
          <a className="cc-btn cc-btn-ghost" href={`/${locale}/stores`}>{t(locale, 'تصفح المحلات', 'Browse stores')}</a>
        </div>
      </div>
      <figure className="cc-hero-media">
        <Image
          src="/images/cairo-shopping-hero-framed.webp"
          alt={t(locale, 'امرأة تحمل حقائب التسوق داخل متجر ملابس', 'A woman carrying shopping bags in a clothing store')}
          width={1400}
          height={788}
          priority
          sizes="(max-width: 860px) 100vw, 54vw"
        />
      </figure>
    </section>
  );
}

export function JourneyStrip({ locale }: { locale: Locale }) {
  const steps = [
    { icon: Search, ar: 'ابحث', en: 'Search', dar: 'عن قطعة أو محل أو منطقة', den: 'for a piece, store or area' },
    { icon: CompareScale, ar: 'قارن', en: 'Compare', dar: 'حتى ثلاث قطع جنبًا إلى جنب', den: 'up to three pieces side by side' },
    { icon: MapPin, ar: 'اعرف المكان', en: 'Find the store', dar: 'العنوان ورقم الهاتف واللوكيشن', den: 'address, phone number and location' },
    { icon: Footprints, ar: 'زر واشترِ', en: 'Visit & buy', dar: 'الشراء يتم مباشرة من المحل', den: 'purchase happens at the store' },
  ];
  return (
    <section className="cc-journey" aria-label={t(locale, 'كيف يعمل الدليل', 'How the guide works')}>
      <ol>
        {steps.map((s, i) => (
          <li key={s.en}>
            <span className="cc-journey-icon" aria-hidden="true"><s.icon size={20} /></span>
            <div>
              <b><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span> {t(locale, s.ar, s.en)}</b>
              <span>{t(locale, s.dar, s.den)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function VisitSection({ locale }: { locale: Locale }) {
  const points = [
    { icon: Info, ar: 'تأكد من التفاصيل', en: 'Check the details', dar: 'السعر والمقاس والتوفر قد يتغير، فراجعها مع المحل قبل الزيارة.', den: 'Price, size and availability can change — confirm them with the store before you go.' },
    { icon: MessageCircle, ar: 'تواصل مع المحل', en: 'Contact the store', dar: 'اسأل عن القطعة أو عن المقاسات المتاحة قبل أن تتحرك.', den: 'Ask about the piece or the sizes in stock before you head out.' },
    { icon: CalendarCheck, ar: 'زر المحل واشترِ مباشرة', en: 'Visit and buy in store', dar: 'لا توجد سلة أو دفع على المنصة؛ الشراء يتم داخل المحل.', den: 'There is no cart or payment on the platform — you buy at the store itself.' },
  ];
  return (
    <section className="cc-visit" id="visit" aria-labelledby="visit-title">
      <div className="cc-visit-head">
        <p className="cc-eyebrow cc-eyebrow-light"><span aria-hidden="true" />{t(locale, 'الخطوة التالية', 'Next, in person')}</p>
        <h2 id="visit-title">{t(locale, 'وجدت قطعتك؟ قابلها في المحل.', 'Found your piece? Meet it in the store.')}</h2>
          <p>{locale === 'ar' ? <><span className="cc-wordmark">CAIRO CLOTHES</span> لا تبيع ولا تشحن ولا تستقبل مدفوعات. دورنا أن تصل إلى المحل المناسب بثقة.</> : <><span className="cc-wordmark">CAIRO CLOTHES</span> does not sell, ship or take payments. Our job is to get you to the right store with confidence.</>}</p>
      </div>
      <ul>
        {points.map((p) => (
          <li key={p.en}>
            <span className="cc-visit-icon" aria-hidden="true"><p.icon size={20} /></span>
            <b>{t(locale, p.ar, p.en)}</b>
            <span>{t(locale, p.dar, p.den)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SiteFooter({ locale, isDemo = false }: { locale: Locale; isDemo?: boolean }) {
  const other = locale === 'ar' ? 'en' : 'ar';
  return (
    <footer className="cc-footer">
      <div className="cc-footer-main">
        <div className="cc-footer-brand">
          <Brand locale={locale} light />
          <p>{t(locale, 'اكتشف محليًا، اختر بثقة.', 'Discover local. Choose well.')}</p>
        </div>
        <nav aria-label={t(locale, 'روابط مفيدة', 'Useful links')}>
          <a href={homePath(locale) + '#discover'}>{t(locale, 'اكتشف', 'Discover')}</a>
          <a href={`/${locale}/stores`}>{t(locale, 'دليل المحلات', 'Store directory')}</a>
          <a href={`/${locale}/online-stores`}>{t(locale, 'المتاجر الأونلاين', 'Online stores')}</a>
          <a href={'/' + locale + '/about'}>{locale === 'ar' ? 'عن كايرو كلوثز' : <>About <span className="cc-wordmark">CAIRO CLOTHES</span></>}</a>
          <a href={`/${locale}/register`}><StoreIcon size={15} aria-hidden="true" />{t(locale, 'إنشاء حساب', 'Create account')}</a>
          <a href={homePath(other)} lang={other} hrefLang={other}>{locale === 'ar' ? 'English' : 'العربية'}</a>
        </nav>
      </div>
      <div className="cc-footer-resources">
        <section>
          <h2>{t(locale, 'للمتسوق', 'For shoppers')}</h2>
          <a href={homePath(locale) + '#discover'}>{t(locale, 'اكتشف المنتجات', 'Discover products')}</a>
          <a href={`/${locale}/stores`}>{t(locale, 'دليل المحلات', 'Store directory')}</a>
          <a href={`/${locale}/account`}>{t(locale, 'حسابي', 'My account')}</a>
          <a href={`/${locale}/favorites`}>{t(locale, 'مفضلاتي', 'My favorites')}</a>
          <a href={`/${locale}/register`}>{t(locale, 'إنشاء حساب', 'Create an account')}</a>
        </section>
        <section>
          <h2>{t(locale, 'لصاحب المحل', 'For store owners')}</h2>
          <a href={`/${locale}/join-store`}>{t(locale, 'إنشاء صفحة محل', 'Create a store page')}</a>
          <a href={`/${locale}/store-dashboard`}>{t(locale, 'مساحة المحل وإدارة المنتجات', 'Store space and products')}</a>
          <a href={`/${locale}/login`}>{t(locale, 'تسجيل الدخول', 'Sign in')}</a>
        </section>
      </div>
      <section className="cc-footer-legal">
        <h2>{t(locale, 'المعلومات القانونية', 'Legal information')}</h2>
        <nav aria-label={t(locale, 'الصفحات القانونية', 'Legal pages')}>
          {footerLegalLinks.map((id) => (
            <a key={id} href={legalUrl(locale, id)}>{LEGAL_DOCUMENTS[id].title[locale]}</a>
          ))}
          <a className="cc-footer-contact" href="mailto:CAIROCLOTHES2026@GMAIL.COM">
            {locale === 'ar' ? 'تواصل معنا' : 'Contact us'}: CAIROCLOTHES2026@GMAIL.COM
          </a>
        </nav>
      </section>
      <p className="cc-footer-note">
        {isDemo
          ? t(locale,
              'نسخة تجريبية.',
              'Demo version.')
          : t(locale,
              'تُحدّث المحلات المشاركة بيانات منتجاتها وأسعارها وتوفرها. تواصل مع المحل لتأكيد التفاصيل قبل الزيارة.',
              'Participating stores update their product, price and availability details. Contact the store to confirm before visiting.')}
      </p>
      <p className="cc-footer-copy">
        <span className="cc-wordmark">CAIRO CLOTHES</span> · {locale === 'ar' ? 'العالم أقرب مما تتخيل' : 'THE WORLD IS CLOSER'}
      </p>
      <p className="cc-footer-copy">
        {locale === 'ar'
          ? <>© 2026 · جميع الحقوق محفوظة</>
          : <>© 2026 · All rights reserved</>}
      </p>
    </footer>
  );
}
