import { NextResponse } from 'next/server';
import type { createSupabaseServerClient } from '@/lib/supabase-server';

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const conflicts = new Set(['record_not_archived', 'protected_account', 'account_linked_to_other_stores', 'account_has_external_storage']);

export async function permanentlyDeleteArchivedAccount(supabase: Supabase, kind: 'shopper' | 'store', id: string) {
  const respond = (body: { deleted: true } | { error: string }, status = 200) =>
    NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

  let previousBatch = '';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase.rpc('permanently_delete_archived_account', {
      p_kind: kind,
      p_id: id,
    });
    if (error?.code === '42501') return respond({ error: 'admin_required' }, 403);
    if (error?.code === 'P0002') return respond({ error: 'record_not_found' }, 404);
    if (error?.code === '55000' && conflicts.has(error.message)) return respond({ error: error.message }, 409);
    if (error) return respond({ error: 'permanent_delete_failed' }, 503);
    if (data?.deleted === true) return respond({ deleted: true });

    const paths: unknown = data?.image_paths;
    if (kind !== 'store' || !Array.isArray(paths) || !paths.length
      || paths.some((path) => typeof path !== 'string' || !path.startsWith(`${id.toLowerCase()}/`))) {
      return respond({ error: 'permanent_delete_failed' }, 503);
    }
    const batch = JSON.stringify(paths);
    if (batch === previousBatch) break;
    previousBatch = batch;
    const { error: storageError } = await supabase.storage.from('product-images').remove(paths);
    if (storageError) break;
  }
  return respond({ error: 'permanent_delete_retry' }, 503);
}
