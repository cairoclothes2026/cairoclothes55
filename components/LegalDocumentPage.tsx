import type { Locale } from '@/lib/catalog';
import { LEGAL_DOCUMENTS, LEGAL_VERSION, legalUrl, type LegalDocumentId } from '@/lib/legal';
import { PageBrand } from '@/components/PageBrand';

export function LegalDocumentPage({ locale, documentId }: { locale: Locale; documentId: LegalDocumentId }) {
  const ar = locale === 'ar';
  const doc = LEGAL_DOCUMENTS[documentId];
  const otherDocs = (Object.keys(LEGAL_DOCUMENTS) as LegalDocumentId[]).filter((id) => id !== documentId);
  return <main className="cc-legal-page" dir={ar ? 'rtl' : 'ltr'} lang={locale}>
    <header className="cc-legal-header">
      <PageBrand locale={locale} />
      <a href={legalUrl(ar ? 'en' : 'ar', documentId)} lang={ar ? 'en' : 'ar'}>{ar ? 'English' : 'العربية'}</a>
    </header>
    <article className="cc-legal-document">
      <p className="cc-legal-eyebrow">CAIRO CLOTHES · {ar ? 'الوثائق القانونية' : 'LEGAL DOCUMENTS'}</p>
      <h1>{doc.title[locale]}</h1>
      <p className="cc-legal-intro">{doc.intro[locale]}</p>
      <p className="cc-legal-version">{ar ? 'الإصدار' : 'Version'} {LEGAL_VERSION} · {ar ? 'آخر تحديث: 23 نوفمبر 2026' : 'Last updated: 23 November 2026'}</p>
      {doc.sections.map((section) => <section key={section.heading.en}><h2>{section.heading[locale]}</h2><p>{section.body[locale]}</p></section>)}
      {documentId === 'product-policy' && <p className="cc-legal-links"><a href="mailto:cairoclothes2026@gmail.com">{ar ? 'إرسال بلاغ عن منتج أو محتوى' : 'Report a product or listing'}</a></p>}
      <nav className="cc-legal-links" aria-label={ar ? 'وثائق قانونية أخرى' : 'Other legal documents'}>{otherDocs.map((id) => <a key={id} href={legalUrl(locale, id)}>{LEGAL_DOCUMENTS[id].title[locale]}</a>)}</nav>
    </article>
    <footer className="cc-legal-footer">© 2026 CAIRO CLOTHES · <a href="mailto:cairoclothes2026@gmail.com">cairoclothes2026@gmail.com</a></footer>
  </main>;
}
