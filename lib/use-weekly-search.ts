'use client';

import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from './supabase';
import { readSearchSettings } from './search-settings';

type SearchState = { account: string | null; term: string; remaining: number | null | undefined; balanceFailed: boolean; message: 'login' | 'limit' | 'error' | null };
const initial: SearchState = { account: null, term: '', remaining: undefined, balanceFailed: false, message: null };

export function useWeeklySearch(account: string | null, weeklyLimit: boolean | undefined) {
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<SearchState>(initial);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ account: string; term: string; id: string } | null>(null);
  const revision = useRef(0);
  const current = state.account === account ? state : initial;

  useEffect(() => {
    if (!account) return;
    let active = true;
    const version = revision.current;
    void createSupabaseBrowserClient().rpc('weekly_shopper_search', { p_request: null }).then(({ data, error }) => {
      if (active && version === revision.current) {
        setState(prev => ({ ...(prev.account === account ? prev : initial), account, balanceFailed: Boolean(error || !data), remaining: error || !data ? undefined : data.remaining }));
      }
    });
    return () => { active = false; };
  }, [account, weeklyLimit]);

  function clear() {
    revision.current++;
    attempt.current = null;
    setDraft('');
    setState(prev => ({ ...prev, term: '', message: null }));
  }

  async function submit() {
    const term = draft.trim();
    if (!term) { clear(); return; }
    if (pending.current) return;
    const version = ++revision.current;
    pending.current = true;
    setBusy(true);
    try {
      if (!account) {
        const settings = await readSearchSettings();
        if (version === revision.current) {
          setState(settings.hide_guest_search ? { ...initial, message: 'login' } : { ...initial, term });
        }
        return;
      }
      if (attempt.current?.account !== account || attempt.current.term !== term) {
        attempt.current = { account, term, id: crypto.randomUUID() };
      }
      const { data, error } = await createSupabaseBrowserClient().rpc('weekly_shopper_search', { p_request: attempt.current.id });
      if (error || typeof data?.allowed !== 'boolean') throw new Error('quota_unavailable');
      if (version === revision.current) {
        setState({ account, balanceFailed: false, term: data.allowed ? term : current.term, remaining: data.remaining, message: data.allowed ? null : 'limit' });
      }
      attempt.current = null;
    } catch {
      if (version === revision.current) setState({ ...current, account, message: 'error' });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return { draft, setDraft, clear, submit, busy, ...current };
}
