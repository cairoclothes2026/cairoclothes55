'use client';

import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';

type SavedProduct = {
  id: string;
  name_ar: string;
  name_en: string;
  images: string[] | null;
  price_egp: number;
  discount_percent: number;
  store_id: string;
  store?: { whatsapp: string | null; phone: string | null } | null;
};

type SavedPiece = { product_id: string; product: SavedProduct | null };
type Snapshot = { profileId: string; attempt: number; pieces: SavedPiece[]; failed: boolean };
const EMPTY: SavedPiece[] = [];

export function useSavedPieces(profileId: string | null) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<{ profileId: string; productId: string }>();
  const [failedWrite, setFailedWrite] = useState<string | null>(null);
  const inFlight = useRef(false);
  const current = snapshot?.profileId === profileId && snapshot.attempt === attempt ? snapshot : undefined;

  useEffect(() => {
    if (!profileId) return;
    let active = true;

    async function load(id: string) {
      try {
        const { data, error } = await createSupabaseBrowserClient().from('favorites')
          .select('product_id, product:products(id,name_ar,name_en,images,price_egp,discount_percent,store_id,store:stores!products_store_id_fkey(whatsapp,phone))')
          .eq('profile_id', id)
          .order('created_at', { ascending: false })
          .overrideTypes<SavedPiece[], { merge: false }>();
        if (error) throw error;
        if (active) setSnapshot({ profileId: id, attempt, pieces: data ?? [], failed: false });
      } catch {
        if (active) setSnapshot({ profileId: id, attempt, pieces: [], failed: true });
      }
    }

    void load(profileId);
    return () => { active = false; };
  }, [profileId, attempt]);

  async function setSaved(productId: string, save: boolean) {
    if (!profileId || !current || current.failed || inFlight.current) return;
    inFlight.current = true;
    setPending({ profileId, productId });
    setFailedWrite(null);
    try {
      const favorites = createSupabaseBrowserClient().from('favorites');
      const result = save
        ? await favorites.upsert({ profile_id: profileId, product_id: productId }, {
            onConflict: 'profile_id,product_id',
            ignoreDuplicates: true,
          })
        : await favorites.delete().eq('profile_id', profileId).eq('product_id', productId);
      if (result.error) throw result.error;
      setSnapshot((value) => {
        if (!value || value.profileId !== profileId || value.attempt !== attempt) return value;
        const otherPieces = value.pieces.filter((piece) => piece.product_id !== productId);
        return { ...value, pieces: save ? [{ product_id: productId, product: null }, ...otherPieces] : otherPieces };
      });
    } catch {
      setFailedWrite(profileId);
    } finally {
      inFlight.current = false;
      setPending(undefined);
    }
  }

  return {
    pieces: current?.pieces ?? EMPTY,
    loading: Boolean(profileId && !current),
    loadError: current?.failed ?? false,
    writeError: Boolean(profileId && failedWrite === profileId),
    pendingId: pending?.profileId === profileId ? pending.productId : undefined,
    retry: () => setAttempt((value) => value + 1),
    setSaved,
  };
}
