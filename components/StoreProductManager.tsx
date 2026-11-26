'use client';

import { EmailPreference } from './EmailPreference';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, ImagePlus, LogOut, Minus, Package, Pencil, Plus, RefreshCw, Settings, Store, Trash2 } from 'lucide-react';
import type { Locale } from '@/lib/catalog';
import { attributeKeys, emptyAttributes, type Attributes } from '@/lib/garment-attributes';
import { GarmentSelect } from '@/components/GarmentSelect';
import { formatDate, formatNumber } from '@/lib/number-format';
import { getCurrentMapLocation } from '@/lib/browser-location';
import { compressProductImage, productImageExtension } from '@/lib/product-image';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { AuthProviderButtons } from '@/components/AuthProviderButtons';
import { AccountDeletion } from '@/components/AccountDeletion';
import { legalRegistrationStatus, registrationContinuationPath } from '@/lib/legal-registration';
import { StoreAddressForm } from '@/components/StoreAddressForm';
import { StorePhoneForm } from '@/components/StorePhoneForm';
import { PageBrand } from '@/components/PageBrand';

type StoreRow = { id: string; slug: string; name_ar: string; name_en: string; address_ar: string; address_en: string; whatsapp: string | null; phone: string | null; status: string; location_url: string | null; member_role: 'owner' | 'manager' };
type ProductRow = {
  clicks?: number | null;
  piece_type: string | null; pattern: string | null; fabric: string | null; colors: string[];
  id: string;
  store_id: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  category: 'women' | 'men' | 'kids';
  price_egp: number | string;
  discount_percent: number | string;
  sizes: string[];
  images: string[];
  available: boolean;
  updated_at: string;
};
type Draft = {
  attributes: Attributes;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  category: ProductRow['category'];
  price_egp: string;
  discount_percent: string;
  sizes: string;
  image_url: string;
  available: boolean;
};

const blankDraft: Draft = {
  attributes: emptyAttributes,
  name_ar: '', name_en: '', description_ar: '', description_en: '',
  category: 'women', price_egp: '', discount_percent: '0', sizes: '', image_url: '', available: true,
};
const SIZE_OPTIONS = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

function translate(locale: Locale, arabic: string, english: string) {
  return locale === 'ar' ? arabic : english;
}

function copyProduct(product: ProductRow): Draft {
  return {
    attributes: { piece_type: product.piece_type ?? '', color: product.colors?.[0] ?? '', pattern: product.pattern ?? '', fabric: product.fabric ?? '' },
    name_ar: product.name_ar,
    name_en: product.name_en,
    description_ar: product.description_ar ?? '',
    description_en: product.description_en ?? '',
    category: product.category,
    price_egp: String(product.price_egp),
    discount_percent: String(product.discount_percent ?? 0),
    sizes: (product.sizes ?? []).join(', '),
    image_url: product.images?.[0] ?? '',
    available: product.available,
  };
}

export function StoreProductManager({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const configured = isSupabaseConfigured();
  const [access, setAccess] = useState<'checking' | 'not-configured' | 'signed-out' | 'ready'>(() => configured ? 'checking' : 'not-configured');
  const [userEmail, setUserEmail] = useState('');
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [storeNameArDraft, setStoreNameArDraft] = useState('');
  const [storeNameEnDraft, setStoreNameEnDraft] = useState('');
  const [savingStoreName, setSavingStoreName] = useState(false);
  const [locationDraft, setLocationDraft] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [dashboardView, setDashboardView] = useState<'manage' | 'details' | 'preview'>('manage');
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingPriceId, setSavingPriceId] = useState('');
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);

  const tx = (arabic: string, english: string) => ar ? arabic : english;
  const selectedStore = stores.find((store) => store.id === selectedStoreId);
  const activeStores = useMemo(() => stores.filter((store) => store.status === 'active'), [stores]);

  useEffect(() => {
    let active = true;
    async function loadStores() {
      if (!configured) return;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error || !user) { setAccess('signed-out'); return; }
        const legal = await legalRegistrationStatus(supabase);
        if (!active) return;
        if (legal.required) { window.location.replace(registrationContinuationPath(locale)); return; }
        setUserEmail(user.email ?? '');
        setConnectedProviders((user.identities ?? []).map((identity) => identity.provider));

        const response = await fetch('/api/merchant/products', { cache: 'no-store' });
        const result = await response.json() as { stores?: StoreRow[] };
        if (!response.ok || !result.stores) throw new Error('stores_unavailable');
        if (!active) return;
        if (result.stores.length === 0) {
          const { data: profile, error: profileError } = await supabase.from('profiles')
            .select('account_type,role')
            .eq('id', user.id)
            .maybeSingle();
          if (!active) return;
          if (!profileError && profile?.account_type === 'merchant' && profile.role !== 'admin') {
            window.location.replace(`/${locale}/join-store`);
            return;
          }
        }
        setStores(result.stores);
        const firstStore = result.stores.find((store) => store.status === 'active') ?? result.stores[0];
        setSelectedStoreId(firstStore?.id ?? '');
        setStoreNameArDraft(firstStore?.name_ar ?? '');
        setStoreNameEnDraft(firstStore?.name_en ?? '');
        setLocationDraft(firstStore?.location_url ?? '');
        setAccess('ready');
      } catch {
        if (active) {
          setLoadError(translate(locale, 'تعذر تحميل المحلات المرتبطة بهذا الحساب. تحقق من تسجيل الدخول وتشغيل ترحيل صلاحيات البيانات.', 'Could not load stores for this account. Check the sign-in and apply the data-access migration.'));
          setAccess('ready');
        }
      }
    }
    void loadStores();
    return () => { active = false; };
  }, [configured, reloadKey, locale]);

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      if (access !== 'ready' || !selectedStoreId) { setProducts([]); return; }
      const store = stores.find((item) => item.id === selectedStoreId);
      if (!store || store.status !== 'active') { setProducts([]); return; }
      setLoadingProducts(true);
      setLoadError('');
      try {
        const response = await fetch(`/api/merchant/products?store_id=${encodeURIComponent(selectedStoreId)}`, { cache: 'no-store' });
        const result = await response.json() as { products?: ProductRow[] };
        if (!response.ok || !result.products) throw new Error('products_unavailable');
        if (active) setProducts(result.products);
      } catch {
        if (active) {
          setProducts([]);
          setLoadError(translate(locale, 'تعذر تحميل المنتجات. حدّث الصفحة بعد التأكد من إعدادات قاعدة البيانات.', 'Could not load products. Refresh after checking the database setup.'));
        }
      } finally {
        if (active) setLoadingProducts(false);
      }
    }
    void loadProducts();
    return () => { active = false; };
  }, [access, selectedStoreId, stores, reloadKey, locale]);

  async function updateAccountPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setNotice({ kind: 'error', text: newPassword.length < 8 ? tx('كلمة المرور يجب أن تكون 8 أحرف على الأقل.', 'Password must be at least 8 characters.') : tx('كلمتا المرور غير متطابقتين.', 'Passwords do not match.') });
      return;
    }
    setPasswordBusy(true);
    setNotice(null);
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNotice({ kind: 'success', text: tx('تم حفظ كلمة المرور للحساب.', 'Account password saved.') });
      setNewPassword('');
      setConfirmPassword('');
      setAccountSettingsOpen(false);
    } catch {
      setNotice({ kind: 'error', text: tx('تعذر حفظ كلمة المرور. حاول مرة أخرى.', 'Could not save the password. Try again.') });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    setAccess('signed-out');
    setProducts([]);
    setStores([]);
    setSelectedStoreId('');
    setUserEmail('');
    setNotice(null);
  }

  async function saveStoreLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStoreId) return;
    setSavingLocation(true);
    setNotice(null);
    try {
      const response = await fetch('/api/merchant/store-location', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStoreId, location_url: locationDraft }),
      });
      if (!response.ok) throw new Error('location_not_saved');
      const result = await response.json() as { location_url: string | null };
      setStores((current) => current.map((store) => store.id === selectedStoreId ? { ...store, location_url: result.location_url } : store));
      setLocationDraft(result.location_url ?? '');
      setNotice({ kind: 'success', text: tx('تم حفظ موقع المحل.', 'Store location saved.') });
    } catch {
      setNotice({ kind: 'error', text: tx('تعذر حفظ الموقع. تحقق من رابط Google Maps وحاول مرة أخرى.', 'Could not save the location. Check the Google Maps link and try again.') });
    } finally {
      setSavingLocation(false);
    }
  }

  async function saveStoreName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStore || selectedStore.member_role !== 'owner') return;
    if (!storeNameArDraft.trim() && !storeNameEnDraft.trim()) {
      setNotice({ kind: 'error', text: tx('أدخل اسم المحل بالعربية أو الإنجليزية على الأقل.', 'Enter the store name in Arabic or English.') });
      return;
    }
    setSavingStoreName(true);
    setNotice(null);
    try {
      const response = await fetch('/api/merchant/store-name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id, name_ar: storeNameArDraft, name_en: storeNameEnDraft }),
      });
      const result = await response.json() as { name_ar?: string; name_en?: string; error?: string };
      if (!response.ok || !result.name_ar || !result.name_en) throw new Error(result.error ?? 'name_not_saved');
      setStores((current) => current.map((store) => store.id === selectedStore.id
        ? { ...store, name_ar: result.name_ar!, name_en: result.name_en! }
        : store));
      setStoreNameArDraft(result.name_ar);
      setStoreNameEnDraft(result.name_en);
      setNotice({ kind: 'success', text: tx('تم تحديث اسم المحل. سيظهر الاسم الجديد في صفحات عرضه.', 'Store name updated. The new name will appear on its public pages.') });
    } catch {
      setNotice({ kind: 'error', text: tx('تعذر تحديث اسم المحل. تحقق من الاسمين وحاول مرة أخرى.', 'Could not update the store name. Check both names and try again.') });
    } finally {
      setSavingStoreName(false);
    }
  }

  async function detectStoreLocation() {
    setDetectingLocation(true);
    setNotice(null);
    try {
      setLocationDraft(await getCurrentMapLocation());
      setNotice({ kind: 'success', text: tx('تم تحديد الموقع. اضغط «حفظ الموقع» لإظهاره للزوار.', 'Location found. Press “Save location” to show it to visitors.') });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setNotice({ kind: 'error', text: code === 'location_denied'
        ? tx('لم تسمح للمتصفح بالوصول إلى الموقع. فعّل إذن الموقع أو أدخل رابط Google Maps يدويًا.', 'Location permission was denied. Allow location access or paste a Google Maps link instead.')
        : code === 'location_unsupported'
          ? tx('تحديد الموقع غير مدعوم في هذا المتصفح. أدخل رابط Google Maps يدويًا.', 'This browser does not support location detection. Paste a Google Maps link instead.')
          : tx('تعذر تحديد الموقع. تأكد من تفعيل خدمة الموقع وحاول مرة أخرى.', 'Could not detect your location. Check that location services are on and try again.') });
    } finally {
      setDetectingLocation(false);
    }
  }

  function beginCreate() {
    setEditingId('');
    setDraft(blankDraft);
    setImageFile(null);
    setShowForm(true);
    setNotice(null);
  }

  function beginEdit(product: ProductRow) {
    setEditingId(product.id);
    setDraft(copyProduct(product));
    setImageFile(null);
    setShowForm(true);
    setNotice(null);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStoreId) return;
    setBusy(true);
    setNotice(null);
    try {
      if (imageFile && !productImageExtension(imageFile)) throw new Error('invalid_image');
      const uploadImage = imageFile ? await compressProductImage(imageFile) : null;
      const payload = {
        ...draft,
        store_id: selectedStoreId,
        ...(editingId ? { product_id: editingId } : {}),
        price_egp: Number(draft.price_egp),
        discount_percent: Number(draft.discount_percent),
        sizes: draft.sizes.split(',').map((size) => size.trim()).filter(Boolean),
      };
      const json = JSON.stringify(payload);
      const form = uploadImage ? new FormData() : null;
      if (form && uploadImage) {
        form.set('product', json);
        form.set('image', uploadImage);
      }
      const response = await fetch('/api/merchant/products', {
        method: editingId ? 'PATCH' : 'POST',
        headers: form ? undefined : { 'Content-Type': 'application/json' },
        body: form ?? json,
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'save_failed');
      setNotice({ kind: 'success', text: editingId ? tx('تم تحديث المنتج.', 'Product updated.') : tx('تمت إضافة المنتج.', 'Product added.') });
      setShowForm(false);
      setEditingId('');
      setDraft(blankDraft);
      setImageFile(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const message = code === 'store_not_active'
        ? tx('يمكن إضافة المنتجات بعد اعتماد المحل.', 'Products can be added after the store is approved.')
        : code === 'invalid_image'
          ? tx('اختر صورة JPG أو PNG أو WebP لا يتجاوز حجمها 5 ميجابايت.', 'Choose a JPG, PNG, or WebP image up to 5 MB.')
          : code === 'image_upload_failed'
            ? tx('تعذر رفع الصورة. حاول مرة أخرى، وإذا استمر الخطأ تواصل مع دعم الموقع.', 'Could not upload the image. Try again or contact site support.')
            : code === 'authentication_required' || code === 'store_access_denied'
              ? tx('جلسة الدخول الحالية لا تملك صلاحية تعديل هذا المحل. سجّل الدخول بحساب مالك المحل أو مديره.', 'Sign in with the store owner or manager account to edit this store.')
              : tx('تعذر حفظ المنتج. تحقق من البيانات واتصال قاعدة البيانات.', 'Could not save the product. Check the details and database connection.');
      setNotice({ kind: 'error', text: message });
    } finally {
      setBusy(false);
    }
  }

  async function adjustProductPrice(product: ProductRow, change: number) {
    if (savingPriceId) return;
    const previousPrice = Number(product.price_egp);
    const nextPrice = Math.max(0, previousPrice + change);
    if (nextPrice === previousPrice) return;
    setSavingPriceId(product.id);
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, price_egp: nextPrice } : item));
    try {
      const response = await fetch('/api/merchant/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: product.store_id,
          product_id: product.id,
          name_ar: product.name_ar,
          name_en: product.name_en,
          description_ar: product.description_ar ?? '',
          description_en: product.description_en ?? '',
          category: product.category,
          price_egp: nextPrice,
          discount_percent: Number(product.discount_percent ?? 0),
          sizes: product.sizes ?? [],
          image_url: product.images?.[0] ?? '',
          available: product.available,
        }),
      });
      if (!response.ok) throw new Error('price_save_failed');
    } catch {
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, price_egp: previousPrice } : item));
      setNotice({ kind: 'error', text: tx('تعذر حفظ السعر. أُعيد السعر السابق؛ حاول مرة أخرى.', 'Could not save the price. The previous price was restored; try again.') });
    } finally {
      setSavingPriceId('');
    }
  }

  async function saveTypedPrice(product: ProductRow) {
    const raw = priceDrafts[product.id];
    if (raw === undefined) return;
    const nextPrice = Number(raw);
    const previousPrice = Number(product.price_egp);
    if (!Number.isFinite(nextPrice) || nextPrice < 0 || nextPrice > 10000000) {
      setPriceDrafts((current) => { const next = { ...current }; delete next[product.id]; return next; });
      setNotice({ kind: 'error', text: tx('أدخل سعرًا من صفر إلى 10,000,000 جنيه.', 'Enter a price from 0 to 10,000,000 EGP.') });
      return;
    }
    setPriceDrafts((current) => { const next = { ...current }; delete next[product.id]; return next; });
    if (nextPrice === previousPrice || savingPriceId) return;
    setSavingPriceId(product.id);
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, price_egp: nextPrice } : item));
    try {
      const response = await fetch('/api/merchant/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: product.store_id, product_id: product.id, name_ar: product.name_ar, name_en: product.name_en, description_ar: product.description_ar ?? '', description_en: product.description_en ?? '', category: product.category, price_egp: nextPrice, discount_percent: Number(product.discount_percent ?? 0), sizes: product.sizes ?? [], image_url: product.images?.[0] ?? '', available: product.available }),
      });
      if (!response.ok) throw new Error('price_save_failed');
    } catch {
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, price_egp: previousPrice } : item));
      setNotice({ kind: 'error', text: tx('تعذر حفظ السعر. أُعيد السعر السابق؛ حاول مرة أخرى.', 'Could not save the price. The previous price was restored; try again.') });
    } finally {
      setSavingPriceId('');
    }
  }

  async function deleteProduct(product: ProductRow) {
    if (!window.confirm(tx('هل تريد حذف هذا المنتج؟', 'Delete this product?'))) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch('/api/merchant/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStoreId, product_id: product.id }),
      });
      if (!response.ok) throw new Error('delete_failed');
      setNotice({ kind: 'success', text: tx('تم حذف المنتج.', 'Product deleted.') });
      setReloadKey((value) => value + 1);
    } catch {
      setNotice({ kind: 'error', text: tx('تعذر حذف المنتج. حاول مرة أخرى.', 'Could not delete the product. Try again.') });
    } finally {
      setBusy(false);
    }
  }

  const dateText = (value: string) => formatDate(value, locale);

  if (access === 'checking') return <main className="onboarding-page" dir={ar ? 'rtl' : 'ltr'}><section className="onboarding-card"><p role="status">{tx('جارٍ التحقق من تسجيل الدخول…', 'Checking your sign-in…')}</p></section></main>;
  if (access === 'not-configured') return <main className="onboarding-page" dir={ar ? 'rtl' : 'ltr'}><section className="onboarding-card"><div className="onboarding-message error">{tx('إدارة المنتجات غير متاحة في النسخة التجريبية.', 'Product management is unavailable in the demo version.')}</div></section></main>;
  if (access === 'signed-out') return (
    <main className="onboarding-page" dir={ar ? 'rtl' : 'ltr'}>
      <header className="onboarding-header"><PageBrand locale={locale} subtitle={tx('مساحة التاجر', 'MERCHANT SPACE')} /><a href={`/${locale}/join-store`}>{tx('انضم كمحل', 'Join as a store')} ↗</a></header>
      <section className="onboarding-card"><div className="eyebrow dark"><span/> {tx('تسجيل دخول موحد', 'ONE SIGN-IN')}</div><h1>{tx('تسجيل الدخول', 'Sign in')}</h1><p>{tx('استخدم صفحة الدخول الموحدة؛ سنحوّلك تلقائيًا إلى مساحة المحل أو حساب المتسوق.', 'Use the unified sign-in page. We will direct you to the store space or shopper account.')}</p>
        <a className="primary-btn sign-in-submit" href={`/${locale}/login`}>{tx('الانتقال إلى تسجيل الدخول', 'Go to sign in')} ↗</a><a className="outline-btn new-account-link" href={`/${locale}/register`}>{tx('حساب جديد', 'Create an account')}</a>
      </section>
    </main>
  );

  return (
    <main className="dash-shell merchant-products-page" dir={ar ? 'rtl' : 'ltr'}>
      <aside className="dash-sidebar">
        <PageBrand locale={locale} subtitle={tx('مساحة التاجر', 'MERCHANT SPACE')} />
        <div className="merchant-card"><div className="merchant-avatar"><Store size={17}/></div><div><b dir="ltr">{userEmail}</b><small>{tx('مساحة المحل', 'Store space')}</small></div></div>
        <nav className="merchant-nav" aria-label={tx('مساحة المحل', 'Store space')}>
          <button type="button" className="side-link" aria-pressed={dashboardView === 'manage'} onClick={() => setDashboardView('manage')}><Package size={17}/>{tx('المنتجات', 'Products')}</button>
          <button type="button" className="side-link" aria-pressed={dashboardView === 'details'} onClick={() => { setDashboardView('details'); setNotice(null); }}><Store size={17}/>{tx('بيانات المحل', 'Store details')}</button>
          <button type="button" className="side-link" aria-pressed={dashboardView === 'preview'} onClick={() => setDashboardView('preview')}><Eye size={17}/>{tx('معاينة صفحة المحل', 'Store page preview')}</button>
          <a className="side-link" href={`/${locale}`}>{tx('العودة إلى الموقع', 'Back to website')}</a>
        </nav>
        <button className="merchant-logout" type="button" onClick={signOut}><LogOut size={16}/>{tx('تسجيل الخروج', 'Sign out')}</button>
      </aside>
      <section className="dash-main">
        <header className="dash-header">
          <span>{dashboardView === 'preview' ? tx('معاينة صفحة المحل', 'Store page preview') : tx('مساحة المحل', 'Store space')}</span>

        </header>
        <div className="dash-content">
          {dashboardView === 'preview' ? <section className="merchant-preview-section"><div className="eyebrow dark"><span/> {tx('معاينة للعرض فقط', 'READ-ONLY PREVIEW')}</div><h1>{selectedStore ? (ar ? selectedStore.name_ar : selectedStore.name_en) : tx('معاينة صفحة المحل', 'Store page preview')}</h1><p>{tx('هكذا ستظهر المنتجات للزوار في صفحة المحل.', 'This is how the products appear to visitors on your store page.')}</p>{!products.length ? <p className="admin-state">{tx('لا توجد منتجات لعرضها بعد.', 'No products to preview yet.')}</p> : <div className="merchant-preview-grid">{products.map((product) => { const discount = Number(product.discount_percent ?? 0); const price = Number(product.price_egp); const image = product.images?.[0]; return <article className="merchant-preview-card" key={product.id}><div className="merchant-preview-photo">{image ? <div role="img" aria-label={ar ? product.name_ar : product.name_en} style={{ backgroundImage: `url("${image.replace(/["\\]/g, "")}")` }} /> : <ImagePlus size={24}/>} {discount > 0 && <span>{ar ? `خصم ${formatNumber(discount, locale)}٪` : `${formatNumber(discount, locale)}% OFF`}</span>}</div><div className="merchant-preview-info"><small>{tx(product.category === 'men' ? 'رجال' : product.category === 'women' ? 'نساء' : 'أطفال', product.category === 'men' ? 'Men' : product.category === 'women' ? 'Women' : 'Kids')}</small><h2>{ar ? product.name_ar : product.name_en}</h2><div className="merchant-preview-price">{discount > 0 ? <><del>{formatNumber(price, locale)} {tx('جنيه', 'EGP')}</del><b>{formatNumber(Math.round(price * (1 - discount / 100)), locale)} {tx('جنيه', 'EGP')}</b></> : <b>{formatNumber(price, locale)} {tx('جنيه', 'EGP')}</b>}</div>{product.sizes?.length > 0 && <div className="merchant-preview-sizes">{product.sizes.map((size) => <span key={size}>{size}</span>)}</div>}<span className={product.available ? 'merchant-availability' : 'merchant-availability off'}>{product.available ? tx('متاح', 'Available') : tx('غير متاح', 'Unavailable')}</span></div></article>; })}</div>}</section> : <>
          <div className="dash-title-row"><div><h1>{dashboardView === 'details' ? tx('بيانات المحل', 'Store details') : tx('إدارة المنتجات', 'Manage products')}</h1>{dashboardView === 'manage' && <p>{tx('أضف القطع المتاحة في محلك أو حدّث أسعارها ومقاساتها.', 'Add the pieces available in your store or update their prices and sizes.')}</p>}</div>
            {dashboardView === 'details' && <button className="outline-btn" type="button" onClick={() => { setNotice(null); setAccountSettingsOpen(true); }}><Settings size={16}/>{tx('تغيير كلمة مرور الحساب', 'Change account password')}</button>}
            {dashboardView === 'manage' && activeStores.length > 0 && selectedStore?.status === 'active' && <button className="primary-btn" type="button" onClick={beginCreate}><Plus size={16}/>{tx('أضف منتجًا', 'Add a product')}</button>}
          </div>

          {notice && <div className={`onboarding-message ${notice.kind}`}>{notice.text}</div>}
          {loadError && <div className="onboarding-message error" role="alert">{loadError}</div>}
          {stores.length === 0 && !loadError && <section className="admin-panel merchant-empty"><h2>{tx('لا يوجد محل مرتبط بهذا الحساب', 'No store is linked to this account')}</h2><p>{tx('استخدم بريد مالك المحل أو مديره. إذا أرسلت طلبًا للتو، سجّل الدخول بالبريد نفسه بعد تأكيده.', 'Sign in with the store owner or manager email. If you just submitted an application, use the same email after confirming it.')}</p></section>}

          {stores.length > 0 && <>
            <div className="merchant-store-picker"><label htmlFor="merchant-store">{tx('المحل', 'Store')}</label><select id="merchant-store" value={selectedStoreId} onChange={(event) => { const nextId = event.target.value; const nextStore = stores.find((store) => store.id === nextId); setSelectedStoreId(nextId); setStoreNameArDraft(nextStore?.name_ar ?? ''); setStoreNameEnDraft(nextStore?.name_en ?? ''); setLocationDraft(nextStore?.location_url ?? ''); }}>{stores.map((store) => <option key={store.id} value={store.id}>{ar ? store.name_ar : store.name_en} · {store.status === 'active' ? tx('معتمد', 'Approved') : store.status === 'pending' ? tx('قيد المراجعة', 'Pending') : store.status === 'paused' ? tx('موقوف', 'Paused') : tx('مرفوض', 'Rejected')}</option>)}</select><button className="outline-btn" type="button" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw size={14}/>{tx('تحديث', 'Refresh')}</button></div>
            {dashboardView === 'details' && <>
            {selectedStore?.member_role === 'owner' && <section className="admin-panel merchant-location-panel"><div className="panel-heading"><div><h2>{tx('اسم المحل', 'Store name')}</h2><p>{tx('يمكنك إدخال الاسم بالعربية أو الإنجليزية أو كليهما. اترك إحدى الخانتين فارغة للاحتفاظ باسمها الحالي. خيار التعديل يظهر في مساحة صاحب المحل فقط.', 'Enter the name in Arabic, English, or both. Leave either field blank to keep its current name. This editing option is only available in the store owner space.')}</p></div></div><form className="merchant-location-form" onSubmit={saveStoreName}><label htmlFor="store-name-ar">{tx('اسم المحل بالعربية (اختياري)', 'Store name in Arabic (optional)')}</label><input id="store-name-ar" type="text" maxLength={120} value={storeNameArDraft} onChange={(event) => setStoreNameArDraft(event.target.value)} /><label htmlFor="store-name-en">{tx('اسم المحل بالإنجليزية (اختياري)', 'Store name in English (optional)')}</label><input id="store-name-en" type="text" maxLength={120} value={storeNameEnDraft} onChange={(event) => setStoreNameEnDraft(event.target.value)} /><button className="primary-btn" type="submit" disabled={savingStoreName}>{savingStoreName ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ اسم المحل', 'Save store name')}</button></form></section>}
            {selectedStore && <section className="admin-panel merchant-location-panel"><div className="panel-heading"><div><h2>LOCATION · {tx('موقع المحل', 'Store location')}</h2><p>{tx('أضف رابط Google Maps ليصل الزوار إلى موقعك مباشرة.', 'Add your Google Maps link so visitors can open your location directly.')}</p></div></div><form className="merchant-location-form" onSubmit={saveStoreLocation}><label htmlFor="store-location-url">{tx('رابط الموقع', 'Location link')}</label><input id="store-location-url" type="url" inputMode="url" placeholder="https://maps.google.com/..." maxLength={1000} value={locationDraft} onChange={(event) => setLocationDraft(event.target.value)} /><small>{tx('يمكنك تحديد الموقع من الجهاز بعد الوقوف داخل المحل، أو لصق رابط المشاركة من Google Maps. اترك الحقل فارغًا لإزالة الموقع.', 'Detect your device location while at the store, or paste a Google Maps share link. Leave it empty to remove the location.')}</small><button className="outline-btn" type="button" disabled={detectingLocation || savingLocation} onClick={() => void detectStoreLocation()}>{detectingLocation ? tx('جارٍ تحديد الموقع…', 'Finding location…') : tx('تحديد موقعي تلقائيًا', 'Detect my location')}</button><button className="primary-btn" type="submit" disabled={savingLocation || detectingLocation}>{savingLocation ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ الموقع', 'Save location')}</button></form></section>}
            {selectedStore && <StoreAddressForm
              key={selectedStore.id}
              locale={locale}
              store={selectedStore}
              onSave={(storeId, addresses) => setStores((current) => current.map((store) =>
                store.id === storeId ? { ...store, ...addresses } : store
              ))}
            />}
            {selectedStore && <StorePhoneForm
              key={`phone-${selectedStore.id}`}
              locale={locale}
              store={selectedStore}
              onSave={(storeId, phone) => setStores((current) => current.map((store) =>
                store.id === storeId ? { ...store, phone, whatsapp: phone?.slice(1) ?? null } : store
              ))}
            />}
            </>}
            {selectedStore?.status === 'pending' && <div className="admin-state">{tx('المحل قيد المراجعة. يمكنك إدارة المنتجات بعد اعتماده، ولن تظهر المنتجات للعامة قبل اعتماد المحل.', 'The store is under review. You can manage products after approval; products stay hidden until the store is approved.')}</div>}
            {selectedStore?.status === 'paused' && <div className="admin-state">{tx('المحل موقوف ومخفي من الموقع حاليًا. تواصل مع مدير المنصة إذا كنت تعتقد أن هذا خطأ.', 'This store is paused and currently hidden from the site. Contact the platform administrator if you think this is a mistake.')}</div>}
            {selectedStore?.status === 'rejected' && <div className="admin-state is-error">{tx('تم رفض طلب المحل. تواصل مع مدير المنصة للمساعدة.', 'This store application was rejected. Contact the platform administrator for help.')}</div>}
            {dashboardView === 'manage' && selectedStore?.status === 'active' && <section className="admin-panel merchant-products-panel">
              <div className="panel-heading"><div><h2>{ar ? selectedStore.name_ar : selectedStore.name_en}</h2><p>{tx(`${formatNumber(products.length, locale)} منتج`, `${formatNumber(products.length, locale)} products`)}</p></div></div>
              {loadingProducts && <p className="admin-state" role="status">{tx('جارٍ تحميل المنتجات…', 'Loading products…')}</p>}
              {!loadingProducts && products.length === 0 && <p className="admin-state">{tx('لا توجد منتجات بعد. أضف أول منتج ليظهر في ملف المحل.', 'No products yet. Add the first product to show it on the store profile.')}</p>}
              <div className="merchant-product-list">{products.map((product) => {
                const image = product.images?.[0];
                return <article className="merchant-product-card" key={product.id}>
                  <div className="merchant-product-image" style={image ? { backgroundImage: `url("${image.replace(/["\\]/g, '')}")` } : undefined}>{!image && <ImagePlus size={22}/>}</div>
                  <div className="merchant-product-copy"><div className="merchant-product-title"><h3>{ar ? product.name_ar : product.name_en}</h3><span className={product.available ? 'merchant-availability' : 'merchant-availability off'}>{product.available ? tx('متاح', 'Available') : tx('غير متاح', 'Unavailable')}</span></div><div className="merchant-price-adjust"><button type="button" className="price-step-btn" aria-label={tx('إنقاص السعر 10 جنيهات', 'Decrease price by 10 EGP')} disabled={Boolean(savingPriceId) || Number(product.price_egp) <= 0} onClick={() => void adjustProductPrice(product, -10)}><Minus size={14}/></button><input className="merchant-price-input" type="number" min="0" max="10000000" step="0.01" aria-label={tx('سعر المنتج بالجنيه', 'Product price in EGP')} value={priceDrafts[product.id] ?? String(product.price_egp)} disabled={Boolean(savingPriceId)} onChange={(event) => setPriceDrafts((current) => ({ ...current, [product.id]: event.target.value }))} onBlur={() => void saveTypedPrice(product)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}/><span>{tx('جنيه', 'EGP')}</span><button type="button" className="price-step-btn" aria-label={tx('زيادة السعر 10 جنيهات', 'Increase price by 10 EGP')} disabled={Boolean(savingPriceId)} onClick={() => void adjustProductPrice(product, 10)}><Plus size={14}/></button>{savingPriceId === product.id && <small role="status">{tx('حفظ…', 'Saving…')}</small>}</div><div className="merchant-product-size-summary"><small>{tx('المقاسات:', 'Sizes:')}</small>{(product.sizes ?? []).length ? product.sizes.map((size) => <span key={size}>{size}</span>) : <small>{tx('غير محددة', 'Not set')}</small>}</div>{selectedStore.member_role === 'owner' && <section className="product-click-count"><strong>{tx('الإحصائيات', 'Statistics')}</strong><div>{tx('عدد الضغطات على المنتج', 'Product clicks')} · {product.clicks == null ? tx('غير متاح', 'Unavailable') : formatNumber(product.clicks, locale)}</div></section>}<small>{tx('آخر تحديث', 'Updated')} · {dateText(product.updated_at)}</small></div>
                  <div className="merchant-product-actions"><button type="button" className="outline-btn" disabled={busy} onClick={() => beginEdit(product)}><Pencil size={14}/>{tx('تعديل', 'Edit')}</button><button type="button" className="outline-btn delete-product-btn" disabled={busy} onClick={() => void deleteProduct(product)}><Trash2 size={14}/>{tx('حذف', 'Delete')}</button></div>
                </article>;
              })}</div>
            </section>}
          </>}

          {dashboardView === 'manage' && <p className="merchant-products-note">{locale === 'ar' ? <>يمكن لمالك المحل ومديره فقط تعديل المنتجات. تظل منتجات المحلات غير المعتمدة مخفية عن دليل <span className="cc-wordmark">CAIRO CLOTHES</span>.</> : <>Only store owners and managers can change products. Products from unapproved stores remain hidden from the <span className="cc-wordmark">CAIRO CLOTHES</span> directory.</>}</p>}
          </>}
        </div>
      </section>

      {accountSettingsOpen && <div className="modal-backdrop" onClick={() => { if (!passwordBusy) setAccountSettingsOpen(false); }}><form className="product-modal merchant-product-form account-password-form" onSubmit={updateAccountPassword} onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" aria-label={tx('إغلاق', 'Close')} onClick={() => setAccountSettingsOpen(false)}>×</button><div className="eyebrow dark"><span/> {tx('إعدادات الحساب', 'ACCOUNT SETTINGS')}</div><h2>{tx('إعدادات تسجيل الدخول', 'Sign-in settings')}</h2><EmailPreference locale={locale}/><div className="account-link-settings"><h3>{tx('ربط حساب اجتماعي', 'Connect a social account')}</h3><p>{tx('استخدم أحد الحسابات الاجتماعية المرتبطة لتسجيل الدخول إلى مساحة المحل.', 'Use a connected social account to sign in to your store space.')}</p><AuthProviderButtons locale={locale} mode="link" redirectPath={`/${locale}/store-dashboard`} connectedProviders={connectedProviders}/></div><p>{tx('أضف كلمة مرور من 8 أحرف على الأقل لتسجيل الدخول بالبريد وكلمة المرور.', 'Set a password of at least 8 characters to sign in with your email and password.')}</p><label>{tx('كلمة المرور الجديدة', 'New password')}<span className="auth-password-field"><input required type={showNewPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/><button type="button" className="auth-password-toggle" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? tx('إخفاء كلمة المرور', 'Hide password') : tx('إظهار كلمة المرور', 'Show password')}>{showNewPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label><label>{tx('تأكيد كلمة المرور', 'Confirm password')}<span className="auth-password-field"><input required type={showConfirmPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/><button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? tx('إخفاء كلمة المرور', 'Hide password') : tx('إظهار كلمة المرور', 'Show password')}>{showConfirmPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>{notice && <div className={`onboarding-message ${notice.kind}`} role="alert">{notice.text}</div>}<button className="primary-btn" type="submit" disabled={passwordBusy}>{passwordBusy ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ كلمة المرور', 'Save password')}</button>
        <AccountDeletion locale={locale} accountType="merchant" />
      </form></div>}
      {showForm && <div className="modal-backdrop" onClick={() => { if (!busy) setShowForm(false); }}><form className="product-modal merchant-product-form" onSubmit={saveProduct} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" aria-label={tx('إغلاق', 'Close')} onClick={() => setShowForm(false)}>×</button>
        <div className="eyebrow dark"><span/> {tx('إدارة قائمة المحل', 'MANAGE STORE LISTINGS')}</div>
        <h2>{editingId ? tx('تعديل المنتج', 'Edit product') : tx('إضافة منتج جديد', 'Add a new product')}</h2>
        <label>{tx('صورة المنتج', 'Product image')}<input type="file" required={!draft.image_url.trim()} accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}/><small>{imageFile ? imageFile.name : draft.image_url ? tx('اختر صورة جديدة لاستبدال الصورة الحالية.', 'Choose a new image to replace the current one.') : tx('JPG أو PNG أو WebP · حتى 5 ميجابايت', 'JPG, PNG, or WebP · up to 5 MB')}</small></label>
        <label>{tx('اسم المنتج بالعربية', 'Product name in Arabic')}<input required maxLength={120} value={draft.name_ar} onChange={(event) => setDraft({ ...draft, name_ar: event.target.value })}/></label>
        <label>{tx('اسم المنتج بالإنجليزية', 'Product name in English')}<input required maxLength={120} value={draft.name_en} onChange={(event) => setDraft({ ...draft, name_en: event.target.value })}/></label>
        <div className="modal-fields"><label>{tx('السعر الأصلي بالجنيه', 'Original price in EGP')}<input type="number" min="0" max="10000000" step="0.01" required value={draft.price_egp} onChange={(event) => setDraft({ ...draft, price_egp: event.target.value })}/></label><label>{tx('نسبة الخصم ٪ (اختياري)', 'Discount percent (optional)')}<input type="number" min="0" max="100" step="0.01" value={draft.discount_percent} onChange={(event) => setDraft({ ...draft, discount_percent: event.target.value })}/><small>{tx('يظل السعر الأصلي محفوظًا، ويُحسب السعر بعد الخصم تلقائيًا.', 'The original price stays unchanged; the discounted price is calculated automatically.')}</small></label></div>
        <label>{tx('الفئة', 'Category')}<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Draft['category'] })}><option value="men">{tx('رجال', 'Men')}</option><option value="women">{tx('نساء', 'Women')}</option><option value="kids">{tx('أطفال', 'Kids')}</option></select></label>
        <fieldset className="merchant-size-picker"><legend>{tx('المقاسات المتاحة', 'Available sizes')}</legend><div>{SIZE_OPTIONS.map((size) => { const selected = draft.sizes.split(',').map((item) => item.trim()).includes(size); return <label key={size} className={selected ? 'is-selected' : ''}><input type="checkbox" checked={selected} onChange={() => { const current = draft.sizes.split(',').map((item) => item.trim()).filter(Boolean); const next = selected ? current.filter((item) => item !== size) : [...current, size]; setDraft({ ...draft, sizes: SIZE_OPTIONS.filter((item) => next.includes(item)).join(', ') }); }}/>{size}</label>; })}</div></fieldset>
        <div className="garment-fields">{attributeKeys.map(field => <GarmentSelect key={field} field={field} locale={locale}
          required={!editingId || Object.values(draft.attributes).some(Boolean)} value={draft.attributes[field]}
          onChange={value => setDraft({ ...draft, attributes: { ...draft.attributes, [field]: value } })} />)}</div>
        <label className="onboarding-consent"><input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })}/>{tx('المنتج متاح حاليًا في المحل', 'The product is currently available in store')}</label>
        {notice?.kind === 'error' && <p className="onboarding-message error" role="alert">{notice.text}</p>}
        <button className="primary-btn" type="submit" disabled={busy}>{busy ? tx('جارٍ الحفظ…', 'Saving…') : <><Check size={15}/>{editingId ? tx('حفظ التعديلات', 'Save changes') : tx('إضافة المنتج', 'Add product')}</>}</button>
      </form></div>}
    </main>
  );
}

