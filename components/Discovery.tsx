'use client';

import { ProductLink } from './ProductLink';
import { WhatsAppLink } from './WhatsAppLink';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CompareScale } from '@/components/CompareScale';
import { Bell, Heart, Home as HomeIcon, MapPin, Menu, Search, ShoppingBag, SlidersHorizontal, Store as StoreIcon, X, Tag, Navigation, Check, LocateFixed } from 'lucide-react';
import Image from 'next/image';
import { attributeKeys, emptyAttributes, matchesAttributes } from '@/lib/garment-attributes';
import { GarmentSelect } from '@/components/GarmentSelect';
import { CatalogImage } from '@/components/CatalogImage';
import { t, type Area, type CatalogData, type Locale, type Product, type Store } from '@/lib/catalog';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { useSavedPieces } from '@/lib/use-saved-pieces';
import { useWeeklySearch } from '@/lib/use-weekly-search';
import { useSearchSettings } from '@/lib/search-settings';
import { homePath } from '@/lib/home-path';
import { useCatalog } from '@/lib/catalog-client';
import { formatNumber, numberLocale } from '@/lib/number-format';
import { mapCoordinates } from '@/lib/map-location';
import { getCurrentCoordinates } from '@/lib/browser-location';
import { Brand, DemoNotice, GoIcon, Hero, JourneyStrip, SiteFooter, VisitSection } from '@/components/home/HomeSections';
import './home/home.css';

type Category = Product['category'];
const CATEGORY_IDS: Category[] = ['men', 'women', 'kids'];
const CATEGORY_LABEL: Record<Category, { ar: string; en: string }> = {
  women: { ar: 'نساء', en: 'Women' },
  men: { ar: 'رجال', en: 'Men' },
  kids: { ar: 'أطفال', en: 'Kids' },
};
const MAX_PRICE = 10000;
const MAX_COMPARE = 3;
const AREA_KEY = 'cc-area';
const AREA_EVENT = 'cc-area-change';
const NEARBY_RADIUS_KM = 25;
const EMPTY_AREAS: Area[] = [];
const EMPTY_PRODUCTS: Product[] = [];
const EMPTY_STORES: Store[] = [];

// Keep store rows aligned with the responsive product grid.
function subscribeGridWidth(notify: () => void) {
  const queries = ['(max-width: 600px)', '(max-width: 860px)', '(max-width: 1100px)'].map(query => window.matchMedia(query));
  queries.forEach(query => query.addEventListener('change', notify));
  return () => queries.forEach(query => query.removeEventListener('change', notify));
}
function gridColumns() {
  if (window.matchMedia('(max-width: 600px)').matches) return 3;
  if (window.matchMedia('(max-width: 860px)').matches) return 2;
  return window.matchMedia('(max-width: 1100px)').matches ? 3 : 5;
}

function catalogRows(products: Product[], stores: Store[], columns: number) {
  const featured = ['star-trend-50a401bb', 'lotus-flower-0935b5e1'].map(slug => stores.find(store => store.slug === slug)?.id);
  const groups: Product[][] = [[], []];
  const other: Product[] = [];
  const kids: Product[] = [];
  for (const product of products) {
    const index = featured.indexOf(product.storeId);
    if (product.category === 'kids') kids.push(product);
    else if (index >= 0) groups[index].push(product);
    else other.push(product);
  }
  const rows: Product[][] = [];
  for (let offset = 0; offset < Math.max(groups[0].length, groups[1].length); offset += columns) {
    for (const group of groups) {
      if (offset < group.length) rows.push(group.slice(offset, offset + columns));
    }
  }
  rows.push(other, kids);
  return rows.flat();
}

/* ---- remembered area (hydration-safe external store) ---- */
function subscribeArea(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(AREA_EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(AREA_EVENT, cb);
  };
}
function readArea(): string | null {
  try { return window.localStorage.getItem(AREA_KEY); } catch { return null; }
}
function writeArea(id: string) {
  try { window.localStorage.setItem(AREA_KEY, id); } catch { /* storage unavailable: keep UI working */ }
  window.dispatchEvent(new Event(AREA_EVENT));
}

function storeCoordinates(store: Store): { latitude: number; longitude: number } | null {
  if (Number.isFinite(store.latitude) && Number.isFinite(store.longitude)) {
    return { latitude: store.latitude!, longitude: store.longitude! };
  }
  return store.locationUrl ? mapCoordinates(store.locationUrl) : null;
}

function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(to.latitude - from.latitude);
  const lonDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(lonDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Lowercase and fold common Arabic spelling variants so search is forgiving. */
function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

// The server renders the catalog before event handlers are attached.
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function Discovery({ locale, initialArea, initialCatalog = null }: { locale: Locale; initialArea?: string; initialCatalog?: CatalogData | null }) {
  const ar = locale === 'ar';
  const filtersReady = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const { data: catalog, loading: catalogLoading, error: catalogError } = useCatalog(initialCatalog);
  const areas = catalog?.areas ?? EMPTY_AREAS;
  const products = catalog?.products ?? EMPTY_PRODUCTS;
  const stores = catalog?.stores ?? EMPTY_STORES;
  const isDemo = catalog?.source === 'demo';
  const nf = useMemo(() => new Intl.NumberFormat(numberLocale(locale)), [locale]);
  const money = (n: number) => `${nf.format(n)} ${ar ? 'ج.م' : 'EGP'}`;
  const salePrice = (price: number, discount = 0) => Math.round(price * (1 - discount / 100) * 100) / 100;

  const storedArea = useSyncExternalStore(subscribeArea, readArea, () => null);
  const validArea = (id: string | null | undefined) => (id && (id === 'all' || areas.some((a) => a.id === id)) ? id : null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const { settings: searchSettings } = useSearchSettings();
  const showSearch = Boolean(accountId) || (authReady && searchSettings?.hide_guest_search === false);
  const area = showSearch ? validArea(storedArea) ?? validArea(initialArea) ?? 'all' : 'all';

  const [category, setCategory] = useState<Category | null>(null);
  const [priceText, setPriceText] = useState(String(MAX_PRICE));
  const max = !showSearch || priceText === '' ? MAX_PRICE : Number(priceText);
  const [selectedAttributes, setAttributes] = useState(emptyAttributes);
  const attributes = showSearch ? selectedAttributes : emptyAttributes;
  const [availabilityChecked, setOnlyAvailable] = useState(false);
  const onlyAvailable = showSearch && availabilityChecked;
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [productPage, setProductPage] = useState<{ key: string; limit: number }>({ key: '', limit: 20 });
  const [guestSaved, setGuestSaved] = useState<string[]>([]);
  const [wardrobeAccount, setWardrobeAccount] = useState<string | null>(null);
  const search = useWeeklySearch(accountId, searchSettings?.weekly_limit);
  const query = showSearch ? search.term : '';
  const [selectedLocation, setNearbyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const nearbyLocation = showSearch ? selectedLocation : null;
  const [locationAreaId, setLocationAreaId] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState('');
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const navMarker = useRef<HTMLSpanElement>(null);
  const navContainer = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const [navPinned, setNavPinned] = useState(false);
  useEffect(() => {
    const marker = navMarker.current;
    if (!marker) return;
    const observer = new IntersectionObserver(([entry]) => setNavPinned(entry.boundingClientRect.bottom <= 0));
    observer.observe(marker);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!mobileMoreOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!navContainer.current?.contains(event.target as Node)) setMobileMoreOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileMoreOpen(false); moreButton.current?.focus(); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [mobileMoreOpen]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const hasAccountSession = Boolean(accountId);
  const accountPath = `/${locale}/account`;
  const favoritesPath = `/${locale}/favorites`;
  const accountFavorites = useSavedPieces(catalog?.source === 'database' ? accountId : null);
  const saveToAccount = Boolean(accountId && catalog?.source === 'database');

  const storeDistances = useMemo(() => {
    if (!nearbyLocation) return new Map<string, number>();
    return new Map(stores.flatMap((store) => {
      const coords = storeCoordinates(store);
      return coords ? [[store.id, distanceKm(nearbyLocation, coords)] as const] : [];
    }));
  }, [nearbyLocation, stores]);
  const nearbyStoreIds = useMemo(() => new Set(
    [...storeDistances].filter(([, distance]) => distance <= NEARBY_RADIUS_KM).map(([id]) => id),
  ), [storeDistances]);
  const showNearbyStores = useCallback(async () => {
    setLocationBusy(true);
    setLocationFeedback('');
    try {
      const coords = await getCurrentCoordinates();
      setNearbyLocation(coords);
      const nearestStore = stores
        .map((store) => {
          const position = storeCoordinates(store);
          return position ? { store, distance: distanceKm(coords, position) } : null;
        })
        .filter((entry): entry is { store: Store; distance: number } => entry !== null)
        .sort((a, b) => a.distance - b.distance)[0];
      setLocationAreaId(nearestStore?.store.areaId ?? null);

    } catch (error) {
      setNearbyLocation(null);
      const reason = error instanceof Error ? error.message : 'location_unavailable';
      setLocationFeedback(reason === 'location_denied'
        ? t(locale, 'لم تسمح بتحديد موقعك. يمكنك اختيار المنطقة يدويًا أو عرض كل المحلات.', 'Location permission was denied. Choose an area manually or view all stores.')
        : reason === 'location_unsupported'
          ? t(locale, 'تحديد الموقع غير متاح في هذا المتصفح. اختر المنطقة يدويًا أو اعرض كل المحلات.', 'Location is unavailable in this browser. Choose an area manually or view all stores.')
          : t(locale, 'تعذر تحديد موقعك الآن. اختر المنطقة يدويًا أو حاول مرة أخرى.', 'Could not determine your location. Choose an area manually or try again.'));
    } finally {
      setLocationBusy(false);
    }
  }, [locale, stores]);

  function clearNearby() {
    setNearbyLocation(null);
    setLocationAreaId(null);
    setLocationFeedback('');
  }

  function chooseArea(id: string) {
    setNearbyLocation(null);
    setLocationAreaId(null);
    setLocationFeedback('');
    writeArea(id);
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    const supabase = createSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAccountId(session?.user.id ?? null);
      setAuthReady(true);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    void createSupabaseBrowserClient().from('profiles').select('role,account_type').eq('id', accountId).maybeSingle()
      .then(({data}) => {
        if (active) setWardrobeAccount(data?.account_type === 'customer' && data.role !== 'admin' ? accountId : null);
      });
    return () => { active = false; };
  }, [accountId]);

  const areaName = (id: string) => {
    const a = areas.find((x) => x.id === id);
    return a ? (ar ? a.ar : a.en) : '';
  };
  const storeById = (id: string) => stores.find((s) => s.id === id)!;
  const productById = (id: string) => products.find((p) => p.id === id)!;

  const visible = useMemo(() => {
    const q = normalize(query);
    return products.filter((p) => {
      if (nearbyLocation && !nearbyStoreIds.has(p.storeId)) return false;
      if (!nearbyLocation && area !== 'all' && p.areaId !== area) return false;
      if (category && p.category !== category) return false;
      if (p.price > max) return false;
      if (!matchesAttributes(p, attributes)) return false;
      if (onlyAvailable && !p.available) return false;
      if (!q) return true;
      const s = stores.find((x) => x.id === p.storeId)!;
      const a = areas.find((x) => x.id === p.areaId)!;
      const hay = normalize(`${p.ar} ${p.en} ${s.ar} ${s.en} ${a.ar} ${a.en} ${CATEGORY_LABEL[p.category].ar} ${CATEGORY_LABEL[p.category].en}`);
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [area, areas, attributes, category, max, nearbyLocation, nearbyStoreIds, onlyAvailable, products, query, stores]);
  const productFilterKey = JSON.stringify([area, attributes, category, max, onlyAvailable, query, Boolean(nearbyLocation)]);
  const visibleProductLimit = productPage.key === productFilterKey ? productPage.limit : 20;
  const columns = useSyncExternalStore(subscribeGridWidth, gridColumns, () => 5);
  const orderedProducts = useMemo(() => catalogRows(visible, stores, columns), [visible, stores, columns]);
  const visibleProducts = orderedProducts.slice(0, visibleProductLimit);

  const relatedStores = useMemo(() => {
    const list = stores.filter((store) => nearbyLocation
      ? nearbyStoreIds.has(store.id)
      : area === 'all' || store.areaId === area);
    return nearbyLocation
      ? list.sort((a, b) => (storeDistances.get(a.id) ?? Infinity) - (storeDistances.get(b.id) ?? Infinity))
      : list;
  }, [area, nearbyLocation, nearbyStoreIds, storeDistances, stores]);

  const publishedCategories = CATEGORY_IDS.filter(id => products.some(product => product.category === id));
  const publishedAreas = areas.filter(a => stores.some(store => store.areaId === a.id) || products.some(product => product.areaId === a.id));

  const hasActiveFilters = Boolean(nearbyLocation || Object.values(attributes).some(Boolean) || query || category || max < MAX_PRICE || onlyAvailable);
  const resetFilters = () => { clearNearby(); setAttributes(emptyAttributes); search.clear(); setCategory(null); setPriceText(String(MAX_PRICE)); setOnlyAvailable(false); };
  const toggleCategory = (id: Category) => setCategory((c) => (c === id ? null : id));
  function toggleSaved(id: string, isSaved: boolean) {
    if (saveToAccount) void accountFavorites.setSaved(id, !isSaved);
    else setGuestSaved((items) => isSaved ? items.filter((item) => item !== id) : [...items, id]);
  }
  const toggleCompare = (id: string) => setCompare((v) => (v.includes(id) ? v.filter((x) => x !== id) : v.length < MAX_COMPARE ? [...v, id] : v));
  const removeCompare = (id: string) => setCompare((v) => {
    const next = v.filter((x) => x !== id);
    if (next.length < 2) setCompareOpen(false);
    return next;
  });
  const clearCompare = () => { setCompare([]); setCompareOpen(false); };

  const otherLocale = ar ? 'en' : 'ar';
  const selectedArea = nearbyLocation && locationAreaId && areas.some((item) => item.id === locationAreaId)
    ? locationAreaId
    : area;

  const areaSelect = (id: string, className: string) => (
    <div className={`cc-area ${className}`}>
      <label htmlFor={id} className="cc-sr">{t(locale, 'المكان المحدد أو منطقة البحث', 'Detected place or search area')}</label>
      <MapPin size={16} aria-hidden="true" />
      <select id={id} value={selectedArea} onChange={(e) => chooseArea(e.target.value)}>
        <option value="all">{t(locale, 'كل القاهرة', 'All Cairo')}</option>
        {areas.map((a) => <option key={a.id} value={a.id}>{ar ? a.ar : a.en}</option>)}
      </select>
    </div>
  );

  const balanceText = typeof search.remaining === 'number'
    ? t(locale, `باقي ${search.remaining} محاولات بحث`, `${search.remaining} ${search.remaining === 1 ? 'search' : 'searches'} left`)
    : search.remaining === null
      ? t(locale, 'بحث غير محدود', 'Unlimited searches')
      : search.balanceFailed
        ? t(locale, 'تعذّر تحميل رصيد البحث', 'Search balance unavailable')
        : t(locale, 'جارٍ تحميل الرصيد…', 'Loading balance…');

  function searchField(id: string) {
    return <label className="cc-query-field" htmlFor={id} dir={ar ? 'rtl' : 'ltr'}>
      {accountId && <span id={id + '-balance'} className="cc-search-balance" role="status">{balanceText}</span>}
      <input id={id} type="search" aria-label={t(locale, 'ابحث عن قطعة أو محل', 'Search for a piece or a store')}
        aria-describedby={accountId ? id + '-balance' : undefined} disabled={!filtersReady} enterKeyHint="search"
        value={search.draft} onChange={e => search.setDraft(e.target.value)}
        placeholder={t(locale, 'ابحث عن قطعة أو محل...', 'Search pieces or stores…')} autoComplete="off" />
    </label>;
  }

  return (
    <main className="cc-home" dir={ar ? 'rtl' : 'ltr'} lang={locale}>
      <a className="cc-skip" href="#discover">{t(locale, 'تخطَّ إلى الاكتشاف', 'Skip to discovery')}</a>
      <div className="cc-home-first-screen">
      <DemoNotice locale={locale} isDemo={isDemo} />
      {catalogLoading && <p className="cc-data-message" role="status">{t(locale, 'جارٍ تحميل بيانات المحلات والمنتجات…', 'Loading stores and products…')}</p>}
      {catalogError && <p className="cc-data-message is-error" role="alert">{t(locale, 'تعذر تحميل البيانات من قاعدة البيانات. حاول تحديث الصفحة بعد قليل.', 'We could not load the database catalog. Please refresh the page shortly.')}</p>}

      <div className="cc-mobile-header">
        <div className="cc-mobile-toolbar">
          {showSearch && areaSelect('area-search-mobile', 'cc-area-search-mobile')}
          <div className="cc-mobile-toolbar-actions">
            {!hasAccountSession && <a className="cc-mobile-auth-link" href={`/${locale}/login`}>{t(locale, 'تسجيل الدخول', 'Sign in')}</a>}
            <a className="cc-mobile-auth-link is-primary" href={hasAccountSession ? accountPath : `/${locale}/register`}>
              {hasAccountSession ? t(locale, 'حسابي', 'My account') : t(locale, 'إنشاء حساب', 'Create account')}
            </a>
            <button type="button" className="cc-mobile-notifications" popoverTarget="catalog-updates" aria-label={t(locale, 'جديد المحلات', 'Store updates')}>
              <Bell size={19} aria-hidden="true" />
            </button>
            <section id="catalog-updates" popover="auto" dir={ar ? 'rtl' : 'ltr'} aria-labelledby="catalog-updates-title">
              <header>
                <h2 id="catalog-updates-title">{t(locale, 'أحدث القطع', 'Latest arrivals')}</h2>
                <button type="button" popoverTarget="catalog-updates" popoverTargetAction="hide" aria-label={t(locale, 'إغلاق', 'Close')}><X size={18} /></button>
              </header>
              {products.length > 0 ? (
                <ul>{products.slice(0, 3).map(product => (
                  <li key={product.id}><ProductLink href={`/${locale}/products/${encodeURIComponent(product.id)}`}>{ar ? product.ar : product.en}</ProductLink></li>
                ))}</ul>
              ) : <p>{catalogLoading ? t(locale, 'جارٍ التحميل…', 'Loading…') : catalogError ? t(locale, 'تعذر تحميل القطع.', 'Unable to load arrivals.') : t(locale, 'لا توجد قطع منشورة حاليًا.', 'No pieces have been published yet.')}</p>}
            </section>
          </div>
        </div>
        <div className="cc-mobile-brand"><Brand locale={locale} /></div>
      </div>

      <header className="cc-header">
        <Brand locale={locale} />
        <nav className="cc-nav" aria-label={t(locale, 'التنقل الرئيسي', 'Main navigation')}>
          {!hasAccountSession && <a className="cc-dashboard-link cc-auth-login" href={`/${locale}/login`}>{t(locale, 'تسجيل الدخول', 'Sign in')}</a>}
          <div className="cc-nav-account-tools">
            <a className={`cc-dashboard-link${hasAccountSession ? '' : ' cc-signup-attention'}`} href={hasAccountSession ? accountPath : `/${locale}/register`}>{hasAccountSession ? t(locale, 'حسابي', 'My account') : t(locale, 'إنشاء حساب', 'Create account')}</a>
            <a className={hasAccountSession ? 'cc-lang cc-lang-plain' : 'cc-lang'} href={homePath(otherLocale)} lang={otherLocale} hrefLang={otherLocale} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}>
              {ar ? 'EN' : 'عربي'}
            </a>
          </div>
        </nav>
      </header>

      <div className="cc-nav-slot">
        <span ref={navMarker} className="cc-nav-marker" aria-hidden="true" />
        <div ref={navContainer} className={navPinned ? 'cc-site-navigation is-pinned' : 'cc-site-navigation'}>
          <nav className="cc-mobile-tabbar" aria-label={t(locale, 'أقسام الموقع', 'Site navigation')}>
            <a className="is-current" href={homePath(locale)} aria-current="page"><HomeIcon size={21} aria-hidden="true" /><span>{t(locale, 'الرئيسية', 'Home')}</span></a>
            <a href="#discover" onClick={() => setMobileMoreOpen(false)}><Search size={21} aria-hidden="true" /><span>{t(locale, 'اكتشف', 'Discover')}</span></a>
            <a href={favoritesPath}><Heart size={21} aria-hidden="true" /><span>{t(locale, 'المفضلة', 'Favorites')}</span></a>
            <a href={`/${locale}/stores`}><StoreIcon size={21} aria-hidden="true" /><span>{t(locale, 'المحلات', 'Stores')}</span></a>
            <a href={`/${locale}/online-stores`} aria-label={t(locale, 'المتاجر الأونلاين', 'Online stores')}><ShoppingBag size={21} aria-hidden="true" /><span className="cc-nav-short">{t(locale, 'أونلاين', 'Online')}</span><span className="cc-nav-full">{t(locale, 'المتاجر الأونلاين', 'Online stores')}</span></a>
            <button ref={moreButton} type="button" aria-expanded={mobileMoreOpen} aria-controls="cc-mobile-more" onClick={() => setMobileMoreOpen((open) => !open)}>
              <Menu size={21} aria-hidden="true" /><span>{t(locale, 'المزيد', 'More')}</span>
            </button>
          </nav>
          {mobileMoreOpen && (
            <nav id="cc-mobile-more" className="cc-mobile-more" aria-label={t(locale, 'المزيد من الروابط', 'More links')}>
              {hasAccountSession
                ? <a href={accountPath}>{t(locale, 'حسابي', 'My account')}</a>
                : <>
                    <a href={`/${locale}/login`}>{t(locale, 'تسجيل الدخول', 'Sign in')}</a>
                    <a href={`/${locale}/register`}>{t(locale, 'إنشاء حساب', 'Create account')}</a>
                  </>}
              {accountId && wardrobeAccount === accountId && <a href={accountPath + '#wardrobe'}>{t(locale, 'دولابي', 'My wardrobe')}</a>}
              <a href={`/${locale}/subscriptions`}>{t(locale, 'الاشتراكات', 'Subscriptions')}</a>
              <a href={`/${locale}/join-store`}>{t(locale, 'لأصحاب المحلات', 'For store owners')}</a>
              <a href={homePath(otherLocale)} lang={otherLocale} hrefLang={otherLocale}>{ar ? 'English' : 'العربية'}</a>
            </nav>
          )}
        </div>
      </div>
      <Hero locale={locale} />
      <JourneyStrip locale={locale} />
      </div>

      <section className="cc-mobile-categories" aria-label={t(locale, 'تصفّح حسب الفئة', 'Shop by category')}>
        {CATEGORY_IDS.map((id) => (
          <button key={id} type="button" aria-pressed={category === id} className={category === id ? 'is-active' : ''} onClick={() => { toggleCategory(id); document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' }); }}>
            <Image src={`/images/category-${id}.webp`} alt="" width={180} height={150} sizes="30vw" />
            <span>{CATEGORY_LABEL[id][locale]}</span>
          </button>
        ))}
      </section>


      {showSearch && <form className="cc-mobile-search" role="search" onSubmit={(e) => { e.preventDefault(); void search.submit(); document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' }); }}>
        <button type="submit" className="cc-submit-search" disabled={!filtersReady || search.busy}>{t(locale, 'بحث', 'Search')}</button>
        {searchField('cc-q-mobile')}
        <button type="button" aria-label={t(locale, 'التصفية', 'Filters')} disabled={!filtersReady} aria-expanded={mobileFiltersOpen} aria-controls="cc-filters" onClick={() => {
          const open = !mobileFiltersOpen;
          setMobileFiltersOpen(open);
          if (open) requestAnimationFrame(() => document.getElementById('cc-filters')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        }}>
          <SlidersHorizontal size={19} aria-hidden="true" />
        </button>
      </form>}

      <section id="discover" className="cc-discover" aria-labelledby="discover-title">
        <div className="cc-section-head">
          <p className="cc-eyebrow cc-eyebrow-dark"><span aria-hidden="true" />{t(locale, 'الاكتشاف', 'Discover')}</p>
          <h2 id="discover-title">{t(locale, 'ابحث وقارن واختر محلك', 'Search, compare, pick your store')}</h2>
          <p>{isDemo
            ? t(locale, 'تصفح قطعًا من محلات القاهرة، وتأكد من السعر والتوفر مع المحل.', 'Browse pieces from Cairo stores. Confirm prices and availability with the store.')
            : t(locale, 'اكتشف المنتجات التي نشرتها المحلات المشاركة في مناطق القاهرة المختلفة، وتأكد من السعر والتوفر قبل الزيارة.', 'Explore products published by participating stores across Cairo, and confirm price and availability before you visit.')}</p>
        </div>

        {showSearch && <><form className="cc-controls" role="search" onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'search') e.preventDefault();
        }} onSubmit={(e) => { e.preventDefault(); void search.submit(); }}>
          <div className="cc-search">
            <button type="submit" className="cc-submit-search" disabled={!filtersReady || search.busy}>{t(locale, 'بحث', 'Search')}</button>
            {searchField('cc-q')}
            {(query || search.draft) && (
              <button type="button" className="cc-icon-btn" onClick={search.clear} aria-label={t(locale, 'مسح البحث', 'Clear search')}><X size={16} aria-hidden="true" /></button>
            )}
          </div>
          <div className="cc-location-controls">
            {areaSelect('area-search', 'cc-area-search')}
          </div>
          <fieldset disabled={!filtersReady} id="cc-filters" className={`cc-filters${mobileFiltersOpen ? ' is-mobile-open' : ''}`}>
            <legend><SlidersHorizontal size={15} aria-hidden="true" /> {t(locale, 'تصفية', 'Filters')}</legend>
            <div className="cc-price">
              <label htmlFor="cc-price-value">{t(locale, 'أقصى سعر (ج.م)', 'Max price (EGP)')}</label>
              <div className="cc-price-controls">
                <input type="range" aria-label={t(locale, 'أقصى سعر بالجنيه', 'Maximum price in EGP')} min={0} max={MAX_PRICE} step={1} value={max} onChange={(e) => setPriceText(e.target.value)} />
                <input id="cc-price-value" type="text" dir="ltr" inputMode="numeric" value={priceText}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660));
                    if (/^\d*$/.test(digits)) setPriceText(digits === '' ? '' : String(Math.min(MAX_PRICE, Number(digits))));
                  }}
                  onBlur={() => { if (priceText === '') setPriceText(String(MAX_PRICE)); }} />
              </div>
            </div>
            <div className="garment-fields">{attributeKeys.map(field => <GarmentSelect key={field} field={field} locale={locale} filter
              value={attributes[field]} onChange={value => setAttributes(current => ({ ...current, [field]: value }))} />)}</div>
            <div className="cc-filter-actions">
              <label className="cc-check">
                <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
                <span>{t(locale, 'المتاح فقط', 'Available only')}</span>
              </label>
              <div className="cc-nearby-tools">
                <button type="button" className={`cc-nearby-button${nearbyLocation ? ' is-active' : ''}`} aria-pressed={Boolean(nearbyLocation)} onClick={() => nearbyLocation ? clearNearby() : void showNearbyStores()} disabled={locationBusy}>
                  <LocateFixed size={16} aria-hidden="true" />
                  {locationBusy ? t(locale, 'جارٍ التحديد…', 'Locating…') : locationFeedback ? t(locale, 'إعادة المحاولة', 'Try again') : nearbyLocation ? t(locale, 'إلغاء فلتر القرب', 'Clear nearby filter') : t(locale, 'المحلات القريبة مني', 'Stores near me')}
                </button>
              </div>
            </div>
            {locationFeedback && <p role="status">{locationFeedback}</p>}
          </fieldset>
        </form>
        <div className="cc-search-feedback" role="status" aria-live="polite">
          {search.message === 'login' && <a href={`/${locale}/login`}>{t(locale, 'سجّل الدخول لاستخدام رصيد البحث الأسبوعي', 'Sign in to use your weekly searches')}</a>}
          {search.message === 'error' && t(locale, 'تعذّر تأكيد رصيد البحث. حاول مجددًا.', 'Could not confirm your search balance. Please retry.')}
          {searchSettings?.weekly_limit && search.message === 'limit' && t(locale, 'استخدمت عمليات البحث الخمس. يتجدد رصيدك يوم السبت بتوقيت القاهرة.', 'You have used all five searches. Your balance resets on Saturday, Cairo time.')}
        </div></>}

        <div className="cc-chips" role="group" aria-label={t(locale, 'الفئات', 'Categories')}>
          {CATEGORY_IDS.map((id) => (
            <button key={id} type="button" className={category === id ? 'is-active' : ''} aria-pressed={category === id} onClick={() => toggleCategory(id)}>
              {ar ? CATEGORY_LABEL[id].ar : CATEGORY_LABEL[id].en}
            </button>
          ))}
          {hasActiveFilters && <button type="button" className="cc-chip-clear" onClick={resetFilters}>{t(locale, 'مسح التصفية', 'Clear filters')}</button>}
        </div>

        <p className="cc-count" role="status" aria-live="polite">
          {isDemo
            ? ar ? `${nf.format(visible.length)} قطعة` : `${formatNumber(visible.length, locale)} piece${visible.length === 1 ? '' : 's'}`
            : ar ? `${nf.format(visible.length)} قطعة` : `${formatNumber(visible.length, locale)} piece${visible.length === 1 ? '' : 's'}`}
          {nearbyLocation ? <> · {t(locale, 'في نطاق 25 كم', 'Within 25 km')}</> : area !== 'all' && <> · {areaName(area)}</>}
        </p>

        {((!accountId && guestSaved.length > 0) || accountFavorites.loadError || accountFavorites.writeError) && (
          <div className="cc-saved-controls">
            {!accountId && guestSaved.length > 0 && (
              <a className="cc-saved-link" href={`/${locale}/login`}>{t(locale, 'سجّل الدخول لحفظ القطع في حسابك', 'Sign in to save pieces to your account')}</a>
            )}
            {accountFavorites.loadError && <>
              <span role="alert">{t(locale, 'تعذر تحميل المفضلة.', 'Could not load your favourites.')}</span>
              <button className="cc-chip-clear" type="button" onClick={accountFavorites.retry}>{t(locale, 'إعادة المحاولة', 'Retry')}</button>
            </>}
            {accountFavorites.writeError && <span role="alert">{t(locale, 'تعذر تحديث المفضلة. حاول مرة أخرى.', 'Could not update your favourites. Try again.')}</span>}
          </div>
        )}

        {visible.length > 0 ? (
          <ul className="cc-grid">
            {visibleProducts.map((p) => {
              const s = storeById(p.storeId);
              const isSaved = saveToAccount ? accountFavorites.pieces.some((piece) => piece.product_id === p.id) : guestSaved.includes(p.id);
              const isCompared = compare.includes(p.id);
              const full = !isCompared && compare.length >= MAX_COMPARE;
              const name = ar ? p.ar : p.en;
              return (
                <li key={p.id} className="cc-card">
                  <div className="cc-card-media">
                    <ProductLink className="cc-product-image-link" href={`/${locale}/products/${p.id}`} aria-label={ar ? `تفاصيل ${name}` : `Details for ${name}`}><CatalogImage image={p.image} width={700} height={525} alt={name} /></ProductLink>
                    {(p.discountPercent ?? 0) > 0 && <span className="cc-discount-ribbon">{ar ? `خصم ${nf.format(p.discountPercent!)}٪` : `${p.discountPercent}% OFF`}</span>}
                    {p.offer ? <span className="cc-badge cc-badge-offer"><Tag size={12} aria-hidden="true" />{isDemo ? (ar ? `خصم ${nf.format(p.offer)}٪` : `${p.offer}% off`) : t(locale, 'عرض من المحل', 'Store offer')}</span> : null}
                    <button type="button" className={`cc-heart ${isSaved ? 'is-saved' : ''}`} aria-pressed={isSaved} disabled={saveToAccount && (accountFavorites.loading || accountFavorites.loadError || Boolean(accountFavorites.pendingId))} onClick={() => toggleSaved(p.id, isSaved)} aria-label={ar ? `${isSaved ? 'إزالة' : 'حفظ'} ${name} ${isSaved ? 'من المفضلة' : 'في المفضلة'}` : `${isSaved ? 'Remove' : 'Save'} ${name} ${isSaved ? 'from' : 'to'} favourites`}>
                      <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="cc-card-body">
                    <p className="cc-card-cat">{ar ? CATEGORY_LABEL[p.category].ar : CATEGORY_LABEL[p.category].en}<span className="cc-phone-area" title={areaName(s.areaId)}><MapPin size={11} aria-hidden="true" /><span>{areaName(s.areaId)}</span></span></p>
                    <div className="cc-card-title">
                      <h3>{name}</h3>
                      <span className="cc-price-tag">{(p.discountPercent ?? 0) > 0 ? <><del>{money(p.price)}</del><b>{money(salePrice(p.price, p.discountPercent))}</b></> : money(p.price)}</span>
                    </div>
                    <a className="cc-store-line" href={`/${locale}/stores/${s.slug}`}>
                      <StoreIcon size={14} aria-hidden="true" /><b>{ar ? s.ar : s.en}</b>
                      <span className="cc-store-area"><span aria-hidden="true">·</span>
                      <MapPin size={13} aria-hidden="true" />{areaName(s.areaId)}</span>
                    </a>
                    <div className="cc-contact-row">
                      <p className={`cc-avail ${p.available ? 'is-on' : 'is-off'}`}>
                        <i aria-hidden="true" />
                        <span className="cc-status-full">{p.available ? t(locale, 'متاح حسب آخر تحديث', 'Available per latest update') : t(locale, 'غير متاح حاليًا', 'Currently unavailable')}</span>
                        <span className="cc-status-short">{p.available ? t(locale, 'متاح', 'Available') : t(locale, 'غير متاح', 'Unavailable')}</span>
                      </p>
                      <WhatsAppLink number={s.whatsapp} locale={locale} compact shortLabel={t(locale, 'راسل المحل', 'Message')} />
                    </div>
                    <div className="cc-card-actions">
                      <button type="button" className={`cc-compare-btn ${isCompared ? 'is-active' : ''}`} aria-pressed={isCompared} disabled={full} onClick={() => toggleCompare(p.id)} title={full ? t(locale, 'يمكن مقارنة ثلاث قطع كحد أقصى', 'You can compare up to three pieces') : undefined}>
                        {isCompared ? <Check size={15} aria-hidden="true" /> : <CompareScale size={17} />}
                        {isCompared ? t(locale, 'ضمن المقارنة', 'Comparing') : t(locale, 'قارن', 'Compare')}
                        <span className="cc-sr"> {name}</span>
                      </button>
                      <a className="cc-store-link" href={`/${locale}/stores/${s.slug}`}>
                        {t(locale, 'صفحة المحل', 'View store')}<GoIcon locale={locale} size={15} />
                        <span className="cc-sr"> {ar ? s.ar : s.en}</span>
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="cc-empty">
            <p><b>{t(locale, 'لا توجد قطع تطابق اختياراتك.', 'No pieces match your choices.')}</b></p>
            <p>{t(locale, 'جرّب منطقة أو فئة أخرى، أو ارفع حد السعر.', 'Try another area or category, or raise the price limit.')}</p>
            <button type="button" className="cc-btn cc-btn-primary" onClick={() => { resetFilters(); writeArea('all'); }}>{t(locale, 'عرض كل القطع', 'Show everything')}</button>
          </div>
        )}
        {visible.length > visibleProductLimit && (
          <div className="cc-load-more-wrap">
            <button
              type="button"
              className="cc-btn cc-btn-ghost cc-btn-dark"
              onClick={() => setProductPage({ key: productFilterKey, limit: visibleProductLimit + 20 })}
            >
              {t(locale, 'عرض المزيد من القطع', 'Load more pieces')}
            </button>
          </div>
        )}
      </section>

      <section className="cc-mobile-featured-stores" aria-labelledby="cc-mobile-stores-title">
        <div className="cc-mobile-shelf-heading">
          <div>
            <p>{t(locale, 'المحلات', 'Stores')}</p>
            <h2 id="cc-mobile-stores-title">{nearbyLocation ? t(locale, 'محلات قريبة منك', 'Stores near you') : t(locale, 'محلات مرتبطة باختياراتك', 'Stores behind your results')}</h2>
          </div>
          {showSearch && <button type="button" onClick={() => nearbyLocation ? clearNearby() : void showNearbyStores()} disabled={locationBusy}>
            <MapPin size={14} aria-hidden="true" />{nearbyLocation ? t(locale, 'إلغاء فلتر القرب', 'Clear nearby filter') : t(locale, 'المحلات القريبة مني', 'Stores near me')}
          </button>}
        </div>
        {showSearch && locationFeedback && <p className="cc-mobile-location-feedback" role="status">{locationFeedback}</p>}
        <div className="cc-mobile-store-rail">
          {relatedStores.slice(0, 6).map((store) => (
            <a key={store.id} className="cc-mobile-store-card" href={`/${locale}/stores/${store.slug}`}>
              <CatalogImage image={store.image} width={420} height={280} alt={ar ? store.ar : store.en} />
              <span>{ar ? store.ar : store.en}</span>
              <small><MapPin size={12} aria-hidden="true" />{areaName(store.areaId)}</small>
            </a>
          ))}
        </div>
      </section>

      <section className="cc-stores" aria-labelledby="stores-title">
        <div className="cc-section-head cc-section-head-row">
          <div>
            <p className="cc-eyebrow cc-eyebrow-dark"><span aria-hidden="true" />{t(locale, 'المحلات', 'Stores')}</p>
            <h2 id="stores-title">{nearbyLocation ? t(locale, 'محلات قريبة منك', 'Stores near you') : t(locale, 'محلات مرتبطة باختياراتك', 'Stores behind your results')}</h2>
          </div>
          <a className="cc-btn cc-btn-ghost cc-btn-dark" href={`/${locale}/stores`}>{t(locale, 'دليل المحلات الكامل', 'Full store directory')}<GoIcon locale={locale} /></a>
        </div>
        <ul className="cc-store-grid">
          {relatedStores.map((s) => {
            const n = visible.filter((p) => p.storeId === s.id).length;
            const address = ar ? s.addressAr : s.addressEn;
            return (
              <li key={s.id} className="cc-store-card">
                <CatalogImage image={s.image} width={700} height={525} alt={ar ? s.ar : s.en} />
                <div>
                  <p className="cc-card-cat">{areaName(s.areaId)}</p>
                  <h3><a href={`/${locale}/stores/${s.slug}`}>{ar ? s.ar : s.en}</a></h3>
                  <p className="cc-store-desc">{ar ? s.descriptionAr : s.descriptionEn}</p>
                  <p className="cc-store-addr"><MapPin size={14} aria-hidden="true" />{address}</p>
                  {nearbyLocation && storeDistances.has(s.id) && <p className="cc-store-distance">{t(locale, `على بُعد ${nf.format(Math.round(storeDistances.get(s.id)! * 10) / 10)} كم`, `${formatNumber(Math.round(storeDistances.get(s.id)! * 10) / 10, locale)} km away`)}</p>}
                  <p className="cc-store-count">{n > 0
                    ? t(locale, `${nf.format(n)} من نتائجك`, `${formatNumber(n, locale)} of your results`)
                    : isDemo
                      ? t(locale, 'محل في المنطقة', 'Store in this area')
                      : t(locale, `${nf.format(s.products)} قطعة منشورة`, `${formatNumber(s.products, locale)} published pieces`)}</p>
                  <div className="cc-store-actions">
                    <a href={`/${locale}/stores/${s.slug}`}>{t(locale, 'عرض المحل', 'View store')}<GoIcon locale={locale} size={15} /></a>
                    <a href={s.locationUrl || `https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
                      <Navigation size={14} aria-hidden="true" />{t(locale, 'الاتجاهات', 'Directions')}
                      <span className="cc-sr"> {t(locale, '(تفتح في نافذة جديدة)', '(opens in a new tab)')}</span>
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {catalog?.source === 'database' && (publishedCategories.length > 0 || publishedAreas.length > 0) && (
        <nav className="cc-browse-links" aria-labelledby="browse-catalog-title">
          <h2 id="browse-catalog-title">{t(locale, 'تصفّح الملابس حسب الفئة والمنطقة', 'Browse clothing by category and area')}</h2>
          <ul>
            {publishedCategories.map(id => (
              <li key={id}><a href={'/' + locale + '/' + id}>{CATEGORY_LABEL[id][locale]}</a></li>
            ))}
            {publishedAreas.map(a => (
              <li key={a.id}><a href={'/' + locale + '/locations/' + encodeURIComponent(a.id)}>
                {ar ? 'ملابس في ' + a.ar : 'Clothing in ' + a.en}
              </a></li>
            ))}
          </ul>
        </nav>
      )}

      <VisitSection locale={locale} />
      <SiteFooter locale={locale} isDemo={isDemo} />

      {compare.length > 0 && (
        <aside className="cc-compare" aria-label={t(locale, 'مقارنة القطع', 'Compare pieces')}>
          {compareOpen && compare.length >= 2 && (
            <div className="cc-compare-panel">
              <div className="cc-compare-scroll">
                <table>
                  <caption className="cc-sr">{t(locale, 'مقارنة القطع المختارة', 'Comparison of selected pieces')}</caption>
                  <thead>
                    <tr>
                      <td />
                      {compare.map((id) => <th scope="col" key={id}>{ar ? productById(id).ar : productById(id).en}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><th scope="row">{t(locale, 'السعر', 'Price')}</th>{compare.map((id) => { const product = productById(id); const discount = product.discountPercent ?? 0; return <td key={id}>{discount > 0 ? <><del>{money(product.price)}</del><br/>{money(salePrice(product.price, discount))}</> : money(product.price)}</td>; })}</tr>
                    <tr><th scope="row">{t(locale, 'الفئة', 'Category')}</th>{compare.map((id) => <td key={id}>{ar ? CATEGORY_LABEL[productById(id).category].ar : CATEGORY_LABEL[productById(id).category].en}</td>)}</tr>
                    <tr><th scope="row">{t(locale, 'المحل', 'Store')}</th>{compare.map((id) => { const s = storeById(productById(id).storeId); return <td key={id}><a href={`/${locale}/stores/${s.slug}`}>{ar ? s.ar : s.en}</a></td>; })}</tr>
                    <tr><th scope="row">{t(locale, 'المنطقة', 'Area')}</th>{compare.map((id) => <td key={id}>{areaName(productById(id).areaId)}</td>)}</tr>
                    <tr><th scope="row">{t(locale, 'المقاسات', 'Sizes')}</th>{compare.map((id) => <td key={id} dir="ltr" className="cc-ltr-cell">{productById(id).sizes.join(' · ')}</td>)}</tr>
                    <tr><th scope="row">{t(locale, 'التوفر', 'Availability')}</th>{compare.map((id) => <td key={id}>{productById(id).available ? t(locale, 'متاح حسب آخر تحديث', 'Available per latest update') : t(locale, 'غير متاح', 'Unavailable')}</td>)}</tr>
                    <tr><th scope="row">{t(locale, 'عرض المحل', 'Store offer')}</th>{compare.map((id) => { const o = productById(id).offer; return <td key={id}>{o ? isDemo ? (ar ? `خصم ${nf.format(o)}٪` : `${o}% off`) : t(locale, 'عرض من المحل', 'Store offer') : '—'}</td>; })}</tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="cc-compare-bar">
            <p className="cc-compare-title"><CompareScale size={17} /><b>{t(locale, 'المقارنة', 'Compare')}</b><span>{nf.format(compare.length)}/{nf.format(MAX_COMPARE)}</span></p>
            <ul>
              {compare.map((id) => {
                const p = productById(id);
                return (
                  <li key={id}>
                    <span>{ar ? p.ar : p.en}</span>
                    <button type="button" onClick={() => removeCompare(id)} aria-label={t(locale, `إزالة ${p.ar} من المقارنة`, `Remove ${p.en} from comparison`)}><X size={14} aria-hidden="true" /></button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="cc-btn cc-btn-primary cc-compare-go" disabled={compare.length < 2} aria-expanded={compareOpen} onClick={() => setCompareOpen((o) => !o)}>
              {compare.length < 2 ? t(locale, 'اختر قطعة أخرى', 'Pick one more') : compareOpen ? t(locale, 'إخفاء المقارنة', 'Hide comparison') : t(locale, 'اعرض المقارنة', 'Show comparison')}
            </button>
            <button type="button" className="cc-icon-btn" onClick={clearCompare} aria-label={t(locale, 'مسح المقارنة', 'Clear comparison')}><X size={18} aria-hidden="true" /></button>
          </div>
        </aside>
      )}
    </main>
  );
}
