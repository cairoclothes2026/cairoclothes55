import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { areas as demoAreas, products as demoProducts, stores as demoStores, type CatalogData } from '@/lib/catalog';
import { readCatalog, readProduct } from './catalog-reader';

const demoCatalog: CatalogData = { areas: demoAreas, stores: demoStores, products: demoProducts, source: 'demo' };

/** Read the public RLS-protected catalog on the server so crawlers receive real page content in the first HTML response. */
export const getPublicCatalog = cache(async (id?: string): Promise<CatalogData | null> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const isDev = process.env.NODE_ENV === 'development';
  if (!url || !key) {
    return isDev ? demoCatalog : null;
  }

  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (input, init) => fetch(input, { ...(init ?? {}), cache: 'no-store' }),
      },
    });

    return id === undefined ? await readCatalog(supabase) : await readProduct(supabase, id);
  } catch {
    return null;
  }
});
