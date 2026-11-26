'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Flag, Share2, Star } from 'lucide-react';
import type { Locale } from '@/lib/catalog';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';

type Rating = { count: number; average: number | null; mine: number | null };
type Props = { kind: 'store' | 'product'; id: string; name: string; path: string; locale: Locale };

export function ReportListing({ kind, id, name, path, locale }: Props) {
  const t = (ar: string, en: string) => locale === 'ar' ? ar : en;
  const [rating, setRating] = useState<Rating | null>(null);
  const [ratingStatus, setRatingStatus] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [copyUrl, setCopyUrl] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestId = useRef('');
  const ar = locale === 'ar';

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    let generation = 0;
    const client = createSupabaseBrowserClient();
    const {data: {subscription}} = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSignedIn(Boolean(session?.user));
      const current = ++generation;
      // Leave the auth callback before starting another authenticated request.
      setTimeout(async () => {
        if (!active || current !== generation) return;
        const {data, error} = await client.rpc('read_listing_rating', {p_kind: kind, p_target: id});
        if (active && current === generation) {
          setRating(error ? null : data);
          setRatingStatus(error ? (ar ? 'تعذر تحميل التقييم.' : 'Could not load the rating.') : '');
        }
      }, 0);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [kind, id, ar]);

  async function rate(stars: number) {
    setBusy(true);
    try {
      const {data, error} = await createSupabaseBrowserClient().rpc('rate_listing', {p_kind: kind, p_target: id, p_stars: stars});
      if (error) throw error;
      setRating(data);
      setRatingStatus(t('تم حفظ تقييمك.', 'Your rating was saved.'));
    } catch { setRatingStatus(t('تعذر حفظ التقييم. حاول مرة أخرى.', 'Could not save your rating. Try again.')); }
    finally { setBusy(false); }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || busy) return;
    requestId.current ||= crypto.randomUUID();
    setBusy(true);
    try {
      const {error} = await createSupabaseBrowserClient().rpc('submit_listing_report', {
        p_kind: kind, p_target: id, p_message: message.trim(), p_request: requestId.current,
      });
      if (error) throw error;
      setReportStatus(t('تم إرسال البلاغ إلى الإدارة.', 'Your report was sent to the site administrators.'));
      setReportOpen(false);
      setMessage('');
      requestId.current = '';
    } catch {
      setReportStatus(t('تعذر إرسال البلاغ. حاول مرة أخرى لاحقًا.', 'Could not send the report. Try again later.'));
    } finally { setBusy(false); }
  }

  async function share() {
    const url = new URL(path, window.location.origin).href;
    setShareStatus('');
    setCopyUrl('');
    if (navigator.share) {
      try { await navigator.share({title: name, url}); return; }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus(t('تم نسخ رابط المشاركة.', 'Share link copied.'));
    } catch { setCopyUrl(url); }
  }

  const label = kind === 'store' ? t('الإبلاغ عن المحل','Report store') : t('الإبلاغ عن المنتج','Report product');
  return <section className="listing-feedback" aria-label={t('التقييم والمشاركة والبلاغات','Ratings, sharing and reports')}>
    <strong>{t('التقييم','Rating')} {rating && (rating.count
      ? new Intl.NumberFormat(locale, {maximumFractionDigits: 1}).format(rating.average!) + ' / 5 · ' + t('عدد التقييمات','Ratings') + ' ' + rating.count
      : t('· لا توجد تقييمات بعد','· No ratings yet'))}</strong>
    <div className="listing-stars" role="group" aria-label={t('تقييمك من خمس نجوم','Your rating out of five')}>
      {[1,2,3,4,5].map(n => <button key={n} type="button" aria-pressed={rating?.mine === n} disabled={!signedIn || busy}
        aria-label={t('تقييم ' + n + ' من 5','Rate ' + n + ' out of 5')} onClick={() => void rate(n)}>
        <Star size={21} fill={n <= (rating?.mine ?? rating?.average ?? 0) ? 'currentColor' : 'none'} />
      </button>)}
    </div>
    {!signedIn && <a href={'/' + locale + '/login'}>{t('سجّل الدخول للتقييم', 'Sign in to rate')}</a>}
    {ratingStatus && <small role="status">{ratingStatus}</small>}
    <div className="listing-feedback-actions">
      <button type="button" onClick={() => void share()}><Share2 size={16}/>{t('مشاركة','Share')}</button>
      <button type="button" aria-expanded={reportOpen} onClick={() => { setReportStatus(''); setReportOpen(!reportOpen); }}><Flag size={16}/>{label}</button>
    </div>
    {shareStatus && <small role="status">{shareStatus}</small>}
    {copyUrl && <label>{t('انسخ رابط المشاركة','Copy the share link')}<input readOnly dir="ltr" value={copyUrl} onFocus={e => e.target.select()}/></label>}
    {reportOpen && (signedIn ? <form className="onboarding-form" onSubmit={send}>
      <label>{t('نص البلاغ','Report details')}<textarea required rows={3} maxLength={4000} value={message} onChange={e => { setMessage(e.target.value); requestId.current = ''; }} disabled={busy}/></label>
      <button className="primary-btn" disabled={busy || !message.trim()}>{t('إرسال للإدارة','Send to administrators')}</button>
    </form> : <a href={'/' + locale + '/login'}>{t('سجّل الدخول لإرسال البلاغ', 'Sign in to submit a report')}</a>)}
    {reportStatus && <p role="status">{reportStatus}</p>}
  </section>;
}
