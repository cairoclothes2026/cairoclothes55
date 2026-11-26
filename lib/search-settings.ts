'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient, isSupabaseConfigured } from './supabase';

export type SearchSettings = { weekly_limit: boolean; hide_guest_search: boolean };
const fields = 'weekly_limit,hide_guest_search';

export async function readSearchSettings(): Promise<SearchSettings> {
  const { data, error } = await createSupabaseBrowserClient().from('catalog_search_settings').select(fields).eq('id', 1).single();
  if (error || !data) throw new Error('settings_unavailable');
  return data;
}

export async function saveSearchSetting(key: keyof SearchSettings, value: boolean): Promise<SearchSettings> {
  const { data, error } = await createSupabaseBrowserClient().from('catalog_search_settings')
    .update({ [key]: value }).eq('id', 1).select(fields).single();
  if (error || !data) throw new Error('settings_not_saved');
  window.dispatchEvent(new CustomEvent('search-settings-changed', { detail: data }));
  return data;
}

export function useSearchSettings() {
  const [settings, setSettings] = useState<SearchSettings | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let generation = 0;
    const refresh = async () => {
      if (document.hidden) return;
      const request = ++generation;
      try {
        const next = await readSearchSettings();
        if (request === generation) { setSettings(next); setFailed(false); }
      } catch {
        if (request === generation) setFailed(true);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 120000);
    function onChange(event: Event) {
      if (event instanceof CustomEvent && event.detail) {
        generation++;
        setSettings(event.detail);
        setFailed(false);
      } else {
        void refresh();
      }
    }
    window.addEventListener('focus', refresh);
    window.addEventListener('search-settings-changed', onChange);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      generation++;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('search-settings-changed', onChange);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return { settings, failed };
}
