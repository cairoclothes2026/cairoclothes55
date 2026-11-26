'use client';

import { useEffect, useState } from 'react';
import { areas as demoAreas, products as demoProducts, stores as demoStores, type CatalogData } from '@/lib/catalog';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { readCatalog } from './catalog-reader';

export type { CatalogData } from '@/lib/catalog';
type CatalogState = { data: CatalogData | null; loading: boolean; error: string | null };

const demoCatalog: CatalogData = { areas: demoAreas, stores: demoStores, products: demoProducts, source: 'demo' };

export function useCatalog(initialData: CatalogData | null = null) {
  const [state, setState] = useState<CatalogState>(() => initialData
    ? { data: initialData, loading: false, error: null }
    : isSupabaseConfigured()
      ? { data: null, loading: true, error: null }
      : { data: process.env.NODE_ENV === 'development' ? demoCatalog : null, loading: false, error: null });

  useEffect(() => {
    if (initialData || !isSupabaseConfigured()) return;
    let cancelled = false;
    readCatalog(createSupabaseBrowserClient())
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to load the catalog.';
        if (!cancelled) setState({ data: null, loading: false, error: message });
      });
    return () => { cancelled = true; };
  }, [initialData]);

  return state;
}
