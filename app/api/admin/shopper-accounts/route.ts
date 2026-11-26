import { NextResponse, type NextRequest } from 'next/server';
import { permanentlyDeleteArchivedAccount } from '@/lib/admin-account-deletion';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const shopperIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const privateHeaders = { 'Cache-Control': 'private, no-store' };

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: privateHeaders });
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { response: respond({ error: 'authentication_required' }, 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || profile?.role !== 'admin') {
    return { response: respond({ error: 'admin_required' }, 403) };
  }
  return { supabase };
}

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status') ?? 'registered';
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim();
  const pageParam = request.nextUrl.searchParams.get('page') ?? '1';
  const page = Number(pageParam);
  if ((status !== 'registered' && status !== 'deleted')
    || query.length > 120
    || !/^\d{1,5}$/.test(pageParam) || page < 1 || page > 10000) {
    return respond({ error: 'invalid_request' }, 400);
  }

  try {
    const access = await requireAdmin();
    if ('response' in access) return access.response;

    const { data, error } = await access.supabase.rpc('list_shopper_accounts', {
      p_status: status,
      p_query: query,
      p_page: page,
    });
    if (error?.code === '42501') return respond({ error: 'admin_required' }, 403);
    if (error) return respond({ error: 'shoppers_unavailable' }, 503);
    return respond(data);
  } catch {
    return respond({ error: 'service_unavailable' }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return respond({ error: 'invalid_origin' }, 403);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return respond({ error: 'invalid_request' }, 400);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return respond({ error: 'invalid_request' }, 400);
  }

  const { action, shopper_id: shopperId, reason: suppliedReason } = payload as {
    action?: unknown;
    shopper_id?: unknown;
    reason?: unknown;
  };
  if ((action !== 'soft_delete' && action !== 'restore' && action !== 'purge')
    || typeof shopperId !== 'string' || !shopperIdPattern.test(shopperId)
    || (suppliedReason != null && typeof suppliedReason !== 'string')) {
    return respond({ error: 'invalid_request' }, 400);
  }

  const reason = typeof suppliedReason === 'string' ? suppliedReason.trim() : '';
  if (reason.length > 240) return respond({ error: 'invalid_request' }, 400);

  try {
    const access = await requireAdmin();
    if ('response' in access) return access.response;

    if (action === 'purge') return await permanentlyDeleteArchivedAccount(access.supabase, 'shopper', shopperId);

    const { data, error } = await access.supabase.rpc('change_shopper_account_status', {
      p_shopper_id: shopperId,
      p_action: action,
      p_reason: reason || null,
    });
    if (error?.code === '42501') return respond({ error: 'admin_required' }, 403);
    if (error?.code === 'P0002') return respond({ error: 'shopper_not_found' }, 404);
    if (error?.code === '55000') return respond({ error: 'shopper_has_store' }, 409);
    if (error?.code === '22023') return respond({ error: 'invalid_request' }, 400);
    if (error) return respond({ error: 'shopper_update_failed' }, 503);
    return respond({ shopper: data });
  } catch {
    return respond({ error: 'service_unavailable' }, 503);
  }
}
