'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/catalog';
import { createSupabaseBrowserClient } from '@/lib/supabase';

type Snapshot = Record<string, string | number | boolean | string[] | null>;
type Complaint = {
  id: string; kind: 'product' | 'store'; created_at: string; message: string;
  evidence: {sender: Snapshot; store: Snapshot; owner: Snapshot | null; product: Snapshot | null};
};
const labels: Record<string,string> = {
  id:'المعرّف', name:'الاسم', email:'البريد الإلكتروني', phone:'الهاتف', account_type:'نوع الحساب', role:'الدور',
  created_at:'تاريخ الإنشاء', updated_at:'آخر تحديث', slug:'اسم الرابط', name_ar:'الاسم بالعربية', name_en:'الاسم بالإنجليزية',
  contact_name:'مسؤول التواصل', area:'المنطقة', address_ar:'العنوان بالعربية', address_en:'العنوان بالإنجليزية',
  whatsapp:'واتساب', description_ar:'الوصف بالعربية', description_en:'الوصف بالإنجليزية', location_url:'رابط الموقع',
  latitude:'خط العرض', longitude:'خط الطول', store_id:'معرّف المحل', category:'الفئة', price_egp:'السعر بالجنيه',
  sizes:'المقاسات', colors:'الألوان', images:'الصور', available:'متاح', availability_updated_at:'آخر تحديث للتوفر',
  active:'نشط', discount_percent:'نسبة الخصم', piece_type:'نوع القطعة', pattern:'النقشة', fabric:'الخامة',
};

export function ComplaintsInbox({locale}: {locale: Locale}) {
  const ar = locale === 'ar';
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{page:number; rows:Complaint[] | null; attempt:number} | null>(null);
  useEffect(() => {
    let active = true;
    void createSupabaseBrowserClient().rpc('list_complaints',{p_page:page}).then(({data,error}) => {
      if (active) setResult({page, rows:error ? null : data, attempt});
    });
    return () => { active = false; };
  }, [page, attempt]);
  const stamp = (value:string) => new Intl.DateTimeFormat(locale,{timeZone:'Africa/Cairo', dateStyle:'medium',timeStyle:'medium'}).format(new Date(value));
  if (!result || result.page !== page || result.attempt !== attempt) return <p role="status">{ar ? 'جارٍ تحميل البلاغات…' : 'Loading reports…'}</p>;
  if (!result.rows) return <p role="alert">{ar ? 'تعذر تحميل البلاغات.' : 'Could not load reports.'} <button onClick={() => setAttempt(n=>n+1)}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></p>;
  return <section className="complaints-inbox">
    {!result.rows.length && <p>{ar ? 'لا توجد بلاغات في هذه الصفحة.' : 'No reports on this page.'}</p>}
    {result.rows.map(row => <article key={row.id}>
      <h3>{row.kind === 'store' ? (ar ? 'بلاغ عن محل' : 'Store report') : (ar ? 'بلاغ عن منتج' : 'Product report')} · {String((row.evidence.product || row.evidence.store)[ar ? 'name_ar' : 'name_en'])}</h3>
      <time dateTime={row.created_at}>{stamp(row.created_at)} ({ar ? 'القاهرة' : 'Cairo'})</time>
      <p className="complaint-message">{row.message}</p>
      <details><summary>{ar ? 'تفاصيل البلاغ وقت الإرسال' : 'Details at submission'}</summary>
        <p>{ar ? 'رقم البلاغ' : 'Report ID'} · {row.id}</p>
        {(['sender','store','owner','product'] as const).map(key => {
          const fields = row.evidence[key];
          if (!fields) return null;
          return <section key={key}><h4>{{sender:ar?'مرسل البلاغ':'Submitted by',store:ar?'المحل':'Store',owner:ar?'صاحب المحل':'Store owner',product:ar?'المنتج':'Product'}[key]}</h4>
            <dl>{Object.entries(fields).map(([field,value]) => <div key={field}><dt>{ar ? labels[field] ?? field : field.replaceAll('_',' ')}</dt>
              <dd>{value === null || value === '' ? '—' : Array.isArray(value) ? value.join(' · ') : typeof value === 'boolean' ? (value ? (ar?'نعم':'Yes') : (ar?'لا':'No')) : field.endsWith('_at') ? stamp(String(value)) : String(value)}</dd></div>)}</dl>
          </section>;
        })}
      </details>
    </article>)}
    <nav><button disabled={!page} onClick={()=>setPage(p=>p-1)}>{ar?'السابق':'Previous'}</button> <button disabled={result.rows.length < 25} onClick={()=>setPage(p=>p+1)}>{ar?'التالي':'Next'}</button></nav>
  </section>;
}
