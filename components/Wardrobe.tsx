'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Locale } from '@/lib/catalog';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { options } from '@/lib/garment-attributes';
import { GarmentSelect } from './GarmentSelect';

type Item = { id: string; piece_type: string; color: string };

export function Wardrobe({ owner, locale }: { owner: string; locale: Locale }) {
  const ar = locale === 'ar';
  const [items, setItems] = useState<Item[] | null>(null);
  const [piece, setPiece] = useState('');
  const [color, setColor] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, refresh] = useState(0);
  const load = useCallback(async () => {
    const client = createSupabaseBrowserClient();
    const result: Item[] = [];
    for (;;) {
      const { data, error } = await client.from('wardrobe_items').select('id,piece_type,color')
        .eq('owner_id', owner).order('created_at', { ascending: false }).order('id').range(result.length, result.length + 99);
      if (error) throw error;
      result.push(...data);
      if (data.length < 100) return result;
    }
  }, [owner]);
  useEffect(() => {
    let active = true;
    load().then(result => { if (active) { setItems(result); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [load, revision]);
  async function add(event: FormEvent) {
    event.preventDefault();
    if (busy || !items) return;
    setBusy(true);
    try {
      const { error } = await createSupabaseBrowserClient().from('wardrobe_items')
        .insert({ owner_id: owner, piece_type: piece, color });
      if (error) throw error;
      setPiece(''); setColor(''); refresh(n => n + 1);
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <section id="wardrobe">
    <h1>{ar ? 'دولابي' : 'My wardrobe'}</h1>
    <form className="onboarding-form" onSubmit={add}>
      <div className="garment-fields">
        <GarmentSelect field="piece_type" locale={locale} value={piece} onChange={setPiece} required />
        <GarmentSelect field="color" locale={locale} value={color} onChange={setColor} required />
      </div>
      <button className="primary-btn" type="submit" disabled={busy || !items}>{ar ? 'أضف قطعة إلى دولابي' : 'Add to my wardrobe'}</button>
    </form>
    {error && <p role="alert">{ar ? 'تعذر تحديث الدولاب.' : 'Could not update your wardrobe.'} <button type="button" onClick={() => refresh(n => n + 1)}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></p>}
    {items?.length === 0 && <p>{ar ? 'دولابك فارغ حتى الآن.' : 'Your wardrobe is empty.'}</p>}
    <ul>{items?.map(item => <li key={item.id}>{ar ? options.piece_type[item.piece_type] : item.piece_type} · {ar ? options.color[item.color] : item.color}</li>)}</ul>
  </section>;
}
