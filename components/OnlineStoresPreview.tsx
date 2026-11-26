'use client';

import { useSyncExternalStore, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Check, CreditCard, ShoppingBag } from 'lucide-react';
import { PageBrand } from './PageBrand';
import { homePath } from '@/lib/home-path';
import type { Locale } from '@/lib/catalog';
import { initialPreview, loadPreview, storePreview, subscribePreview, type PreviewItem, type PreviewShop, type PreviewState } from '@/lib/online-preview';
import './online-stores.css';

type Panel = 'browse' | 'orders' | 'merchant' | 'admin';

export function OnlineStoresPreview({ locale, shopId }: { locale: Locale; shopId?: string }) {
  const ar = locale === 'ar';
  const t = (arabic: string, english: string) => ar ? arabic : english;
  const snapshot = useSyncExternalStore(subscribePreview, loadPreview, () => null);
  const data = snapshot ?? initialPreview;
  const [panel, setPanel] = useState<Panel>('browse');
  const [merchantId, setMerchantId] = useState('studio');
  const [purchase, setPurchase] = useState<{ shop: PreviewShop; item: PreviewItem } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState('M');
  const [message, setMessage] = useState('');
  const base = '/' + locale + '/online-stores';
  const shop = data.shops.find(s => s.id === shopId);
  const merchant = data.shops.find(s => s.id === merchantId) ?? data.shops[0];
  const money = (value: number) => new Intl.NumberFormat(ar ? 'ar-EG' : 'en-EG', {style:'currency',currency:'EGP', maximumFractionDigits:2}).format(value);
  function save(next: PreviewState) {
    try { storePreview(next); return true; }
    catch { setMessage(t('تعذّر حفظ المعاينة في المتصفح. تأكد من توفر مساحة أو جرّب صورة أصغر.', 'Unable to save the preview in this browser. Check storage or try a smaller photo.')); return false; }
  }
  function openPanel(next: Panel) {
    setPanel(next); setPurchase(null); setMessage('');
  }
  function pay() {
    if (!purchase || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return;
    const order = { id: crypto.randomUUID(), shopId: purchase.shop.id, shop: purchase.shop.name, item: purchase.item.name, size, quantity, unitPrice: purchase.item.price, confirmed: false, date: new Date().toISOString() };
    if (save({...data, orders:[order, ...data.orders]})) {
      openPanel('orders');
      setMessage(t('نجحت محاكاة الدفع. يمكنك مراجعة الطلب في مساحة التاجر التجريبية.', 'Test payment succeeded. You can review the order in the demo merchant desk.'));
    }
  }
  function createShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = { ar: String(fields.get('ar')).trim(), en: String(fields.get('en')).trim() };
    if (!name.ar || !name.en) return;
    const created = {id: crypto.randomUUID(), name, items: []};
    if (save({...data, shops:[...data.shops, created]})) {
      setMerchantId(created.id); form.reset(); setMessage(t('تم إنشاء صفحة المتجر في المعاينة.', 'The preview storefront is ready.'));
    }
  }
  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = {ar:String(fields.get('ar')).trim(),en:String(fields.get('en')).trim()};
    const price = Number(fields.get('price'));
    const file = fields.get('image');
    if (!name.ar || !name.en || !Number.isFinite(price) || price <= 0) return;
    if (!(file instanceof File) || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 900000) {
      setMessage(t('اختر صورة JPG أو PNG أو WebP أصغر من 900 كيلوبايت.', 'Choose a JPG, PNG or WebP image under 900 KB.')); return;
    }
    const reader = new FileReader();
    reader.onerror = () => setMessage(t('تعذّرت قراءة الصورة.', 'Could not read the photo.'));
    reader.onload = () => {
      const item = {id:crypto.randomUUID(),name,price,image:String(reader.result)};
      if (save({...data, shops:data.shops.map(s => s.id === merchant.id ? {...s,items:[...s.items,item]} : s)})) {
        form.reset(); setMessage(t('أُضيف المنتج إلى صفحة المتجر.', 'Product added to the storefront.'));
      }
    };
    reader.readAsDataURL(file);
  }
  const sections: [Panel,string][] = [
    ['browse', t('المتاجر','Stores')], ['orders',t('طلباتي','My orders')],
    ['merchant',t('مساحة التاجر','Merchant desk')], ['admin',t('معاينة الإدارة','Admin preview')]
  ];
  const visibleOrders = panel === 'merchant' ? data.orders.filter(o => o.shopId === merchant.id) : data.orders;
  const shopLink = (id: string) => base + '?shop=' + encodeURIComponent(id);
  return <main className="online-market" dir={ar ? 'rtl' : 'ltr'} lang={locale}>
    <header><PageBrand locale={locale}/><a href={'/' + (ar ? 'en' : 'ar') + '/online-stores' + (shopId ? '?shop=' + encodeURIComponent(shopId) : '')}>{ar ? 'English' : 'العربية'}</a></header>
    <div className="online-wrap">
      <a className="online-back" href={homePath(locale)}>{t('الرئيسية','Home')}</a>
      <h1>{t('المتاجر الأونلاين','Online stores')}</h1>
      <p className="online-notice">{t('معاينة تجريبية. تُحفظ المتاجر والطلبات التي تنشئها في جلسة متصفحك فقط. لا يُخصم أي مبلغ ولا يُرسل طلب حقيقي إلى التاجر.', 'Interactive preview. Stores and orders you create are saved only in this browser session. No payment is taken and no real order is sent to a merchant.')}</p>
      <nav className="online-tabs" aria-label={t('أقسام المعاينة','Preview sections')}>{sections.map(([key,label]) => <button key={key} aria-pressed={panel === key} onClick={() => openPanel(key)}>{label}</button>)}</nav>
      {message && <p role="status" className="online-notice">{message}</p>}
      {!snapshot ? <p>{t('جارٍ التحميل…','Loading…')}</p> : <>
        {panel === 'browse' && !purchase && (!shopId ? <div className="online-grid">{data.shops.map(s =>
          <a key={s.id} href={shopLink(s.id)} className="online-card">
            {s.items[0] && <Image src={s.items[0].image} width={420} height={270} unoptimized alt=""/>}
            <div><h2>{s.name[locale]}</h2><span>{t('عدد المنتجات','Products')} · {s.items.length}</span></div>
          </a>)}</div> : <>
          <a href={base}>{t('كل المتاجر','All stores')}</a>
          <h2>{shop ? shop.name[locale] : t('المتجر غير موجود في هذه المعاينة','Store not found in this preview')}</h2>
          {shop && !shop.items.length && <p>{t('لم يضف التاجر منتجات بعد.','This merchant has not listed products yet.')}</p>}
          <div className="online-grid">{shop?.items.map(item => <article className="online-card" key={item.id}>
            <Image src={item.image} width={420} height={270} unoptimized alt={item.name[locale]}/>
            <div><h3>{item.name[locale]}</h3><strong>{money(item.price)}</strong>
              <button className="online-action" onClick={() => {setPurchase({shop,item});setQuantity(1);setSize('M');setMessage('');}}><ShoppingBag size={16}/>{t('اطلب القطعة','Order item')}</button></div>
          </article>)}</div>
        </>)}
        {panel === 'browse' && purchase && <section className="online-box">
          <h2>{t('إتمام الطلب','Checkout')}</h2><p>{purchase.shop.name[locale]} · {purchase.item.name[locale]}</p>
          <form onSubmit={e => {e.preventDefault();pay();}}>
            <label>{t('المقاس','Size')}<select value={size} onChange={e=>setSize(e.target.value)}>{['S','M','L','XL'].map(s=><option key={s}>{s}</option>)}</select></label>
            <label>{t('الكمية','Quantity')}<input type="number" min="1" max="10" required value={quantity || ''} onChange={e=>setQuantity(Number(e.target.value))}/></label>
            <p>{t('التوصيل في المعاينة مجاني.','Delivery is free in this preview.')}</p>
            <strong>{t('الإجمالي','Total')} · {money(purchase.item.price*quantity)}</strong>
            <button className="online-action"><CreditCard size={18}/>{t('محاكاة دفع ناجح','Simulate successful payment')}</button>
            <button type="button" onClick={()=>setMessage(t('رُفض الدفع التجريبي. لم يُسجَّل طلب. يمكنك المحاولة مجددًا.', 'Test payment declined. No order was placed. You can retry.'))}>{t('تجربة رفض الدفع','Simulate declined payment')}</button>
            <button type="button" onClick={()=>openPanel('browse')}>{t('العودة للمتجر','Back to store')}</button>
          </form>
        </section>}
        {panel === 'merchant' && <>
          <details className="online-box"><summary>{t('إنشاء متجر أونلاين','Create an online store')}</summary><form onSubmit={createShop}>
            <label>{t('اسم المتجر بالعربية','Store name in Arabic')}<input name="ar" required maxLength={80}/></label>
            <label>{t('اسم المتجر بالإنجليزية','Store name in English')}<input name="en" required maxLength={80}/></label>
            <button className="online-action">{t('أنشئ صفحة المتجر','Create storefront')}</button>
          </form></details>
          <section className="online-box"><label>{t('معاينة حساب التاجر','Preview merchant account')}<select value={merchantId} onChange={e=>{setMerchantId(e.target.value);setMessage('');}}>{data.shops.map(s=><option key={s.id} value={s.id}>{s.name[locale]}</option>)}</select></label>
          <a href={shopLink(merchant.id)}>{t('افتح صفحة المتجر','Open storefront')}</a>
          <details key={merchant.id}><summary>{t('إضافة منتج','Add product')}</summary><form onSubmit={addItem}>
            <label>{t('صورة المنتج','Product photo')}<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required/></label>
            <label>{t('الاسم بالعربية','Product name in Arabic')}<input name="ar" required maxLength={100}/></label>
            <label>{t('الاسم بالإنجليزية','Product name in English')}<input name="en" required maxLength={100}/></label>
            <label>{t('السعر بالجنيه','Price in EGP')}<input type="number" name="price" min="0.01" max="1000000" step="0.01" required/></label>
            <button className="online-action">{t('أضف المنتج','Add product')}</button>
          </form></details></section>
        </>}
        {panel !== 'browse' && <section className="online-box"><h2>{panel === 'merchant' ? t('طلبات المتجر','Store orders') : panel === 'admin' ? t('طلبات جميع المتاجر','All store orders') : t('طلباتي','My orders')}</h2>
          {!visibleOrders.length && <p>{t('لا توجد طلبات حتى الآن.','No orders yet.')}</p>}
          {visibleOrders.map(o=><article className="online-order" key={o.id}>
            <strong>{o.item[locale]} · {money(o.unitPrice*o.quantity)}</strong><p>{o.shop[locale]} · {o.size} × {o.quantity}</p>
            <small>#{o.id.slice(0,8)} · {new Date(o.date).toLocaleString(ar?'ar-EG':'en-GB')}</small>
            <p>{o.confirmed ? t('أكّد التاجر الطلب','Confirmed by the store') : t('مدفوع تجريبيًا · بانتظار تأكيد المتجر','Test payment complete · awaiting store confirmation')}</p>
            {panel==='merchant' && !o.confirmed && <button onClick={()=>save({...data,orders:data.orders.map(order=>order.id===o.id?{...order,confirmed:true}:order)})}><Check size={16}/>{t('تأكيد الطلب','Confirm order')}</button>}
          </article>)}
        </section>}
      </>}
    </div>
  </main>;
}
