import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const responseHeaders = { 'Cache-Control': 'no-store' };

function result(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

async function signedInClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return user && !error ? supabase : null;
}

export async function GET() {
  try {
    const supabase = await signedInClient();
    if (!supabase) return result({ error: 'authentication_required' }, 401);
    const { data, error } = await supabase.rpc('self_deletion_status');
    if (error || !data) return result({ error: 'deletion_unavailable' }, 503);
    return result(data);
  } catch {
    return result({ error: 'deletion_unavailable' }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return result({ error: 'invalid_origin' }, 403);
  }

  let body: { confirmed?: unknown };
  try {
    body = await request.json();
  } catch {
    return result({ error: 'confirmation_required' }, 400);
  }
  if (body?.confirmed !== true) return result({ error: 'confirmation_required' }, 400);

  try {
    const supabase = await signedInClient();
    if (!supabase) return result({ error: 'authentication_required' }, 401);
    const { data, error } = await supabase.rpc('self_delete_account', { p_confirmed: true });
    if (error) {
      if (error.message === 'self_deletion_reauthentication_required') {
        return result({ error: 'reauthentication_required' }, 403);
      }
      if (error.message === 'self_deletion_not_eligible') return result({ error: 'not_eligible' }, 403);
      if (error.message === 'self_deletion_support_required' || error.code === '23503') {
        return result({ error: 'support_required' }, 409);
      }
      return result({ error: 'deletion_unavailable' }, 503);
    }
    if (data?.deleted === true) return result({ deleted: true });

    const paths: unknown = data?.image_paths;
    if (!Array.isArray(paths) || paths.length === 0 || !paths.every((path) => typeof path === 'string')) {
      return result({ error: 'deletion_unavailable' }, 503);
    }
    const { error: storageError } = await supabase.storage.from('product-images').remove(paths);
    if (storageError) return result({ error: 'cleanup_interrupted' }, 503);
    return result({ pending: true }, 202);
  } catch {
    return result({ error: 'deletion_unavailable' }, 503);
  }
}
