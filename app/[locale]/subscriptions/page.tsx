import { notFound } from 'next/navigation';
import { Check, Search, Sparkles, TicketPercent } from 'lucide-react';
import { PageBrand } from '@/components/PageBrand';
import { WeeklySearchDescription } from '@/components/WeeklySearchDescription';
import './subscriptions.css';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return { title: locale === 'ar' ? 'الاشتراكات | Cairo Clothes' : 'Subscriptions | Cairo Clothes' };
}

export default async function SubscriptionsPage({ params }: PageProps) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  const ar = locale === 'ar';
  const t = (arabic: string, english: string) => ar ? arabic : english;
  const reviews = t('قراءة تقييمات العملاء وتعليقاتهم على المنتجات والمحلات', 'Read customer ratings and comments on products and stores');
  const plans = [
    { name: t('بحث', 'Search'), price: 10, icon: Search, tone: 'search', features: [t('١٠ عمليات بحث إضافية', '10 additional searches')] },
    { name: t('اكتشاف', 'Discover'), price: 20, icon: Sparkles, tone: 'discover', features: [t('١٠٠ عملية بحث', '100 searches'), reviews] },
    { name: t('امتياز', 'Privilege'), price: 40, icon: TicketPercent, tone: 'privilege', features: [t('بحث بلا حدود', 'Unlimited searches'), reviews, t('٣ كوبونات، كل منها يمنحك خصمًا إضافيًا ١٠٪ في أي محل', '3 coupons, each for an extra 10% off at any store')] },
  ];
  const otherLocale = ar ? 'en' : 'ar';
  return <main className="shopper-plans" lang={locale} dir={ar ? 'rtl' : 'ltr'}>
    <header className="onboarding-header"><PageBrand locale={locale} /><a href={`/${otherLocale}/subscriptions`} hrefLang={otherLocale} lang={otherLocale}>{ar ? 'English' : 'العربية'}</a></header>
    <div className="plans-content">
      <header className="plans-intro">
        <p className="plans-status">{t('معاينة قبل فتح الاشتراك', 'Preview · subscriptions coming soon')}</p>
        <h1>{t('الاشتراكات', 'Subscriptions')}</h1>
        <WeeklySearchDescription locale={locale} />
      </header>
      <div className="plans-grid">{plans.map(({ name, price, icon: Icon, tone, features }) =>
        <article key={price} className={`plan-card plan-${tone}`}>
          <div className="plan-heading"><h2>{name}</h2><Icon aria-hidden="true" size={26} /></div>
          <p className="plan-price"><strong>{new Intl.NumberFormat(ar ? 'ar-EG' : 'en').format(price)}</strong> {t('جنيه', 'EGP')}</p>
          <p className="plan-term">{t('لمدة ٦ أشهر', 'for 6 months')}</p>
          <ul>{features.map(feature => <li key={feature}><Check size={18} aria-hidden="true" />{feature}</li>)}</ul>
        </article>)}</div>
      <details className="plans-help">
        <summary>{t('كيف أستخدم كوبون الخصم في المحل؟', 'How will I redeem a coupon in store?')}</summary>
        <p>{t('عند تفعيل باقة امتياز، سيصدر الموقع أكواد الخصم الخاصة بحسابك. عند وصولك إلى المحل، أدخل كود الكوبون من حسابك لاسترداد خصم ١٠٪ إضافي على السعر بعد خصم الموقع.', 'When Privilege launches, Cairo Clothes will issue coupon codes tied to your subscriber account. At the store, enter a coupon code from your account to redeem an extra 10% off the price after the listed discount.')}</p>
      </details>
    </div>
  </main>;
}
