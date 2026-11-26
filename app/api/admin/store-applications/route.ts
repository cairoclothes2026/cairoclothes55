import { NextResponse, type NextRequest } from 'next/server';
import { permanentlyDeleteArchivedAccount } from '@/lib/admin-account-deletion';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const storeIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storeStatuses = new Set(['approved', 'pending', 'deleted', 'rejected']);
const privateResponse = { headers: { 'Cache-Control': 'private, no-store' } };

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { response: NextResponse.json({ error: 'authentication_required' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    return { response: NextResponse.json({ error: 'admin_required' }, { status: 403 }) };
  }

  return { supabase, userId: user.id };
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireAdmin();
    if ('response' in access) return access.response;

    const params = request.nextUrl.searchParams;
    if (params.has('status') || params.has('q') || params.has('page')) {
      const status = params.get('status');
      const query = (params.get('q') ?? '').trim();
      const pageParam = params.get('page') ?? '1';
      const page = Number(pageParam);
      if (!status || !storeStatuses.has(status) || query.length > 160
        || !/^[1-9]\d{0,5}$/.test(pageParam) || page > 100000) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
      }

      const { data, error } = await access.supabase.rpc('list_admin_store_applications', {
        p_status: status,
        p_query: query,
        p_page: page,
      });
      if (error?.code === '42501') return NextResponse.json({ error: 'admin_required' }, { status: 403 });
      if (error) return NextResponse.json({ error: 'applications_unavailable' }, { status: 503 });
      return NextResponse.json(data, privateResponse);
    }

    const { data, error } = await access.supabase
      .from('stores')
      .select('id,owner_id,slug,name_ar,name_en,area_id,address_ar,address_en,contact_name,phone,status,admin_archived_at,admin_archive_previous_status,created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: 'applications_unavailable' }, { status: 503 });
    return NextResponse.json({ applications: data ?? [] }, privateResponse);
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const body = payload as { store_id?: unknown; decision?: unknown; action?: unknown };
  const storeId = typeof body.store_id === 'string' ? body.store_id : '';
  const decision = body.decision;
  try {
    const access = await requireAdmin();
    if ('response' in access) return access.response;

    if (body.action === 'archive_all') {
      const { data, error } = await access.supabase.rpc('archive_all_stores_from_site');
      if (error) return NextResponse.json({ error: 'archive_failed' }, { status: 400 });
      return NextResponse.json({ archived_count: Number(data?.archived_count ?? 0) });
    }

    if (body.action === 'approve_all_pending') {
      const { data, error } = await access.supabase.rpc('approve_all_pending_stores');
      if (error?.code === '42501') return NextResponse.json({ error: 'admin_required' }, { status: 403 });
      if (error) return NextResponse.json({ error: 'review_failed' }, { status: 503 });
      return NextResponse.json({ approved_count: Number(data?.approved_count ?? 0) });
    }

    if (!storeIdPattern.test(storeId)) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    if (body.action === 'purge') return await permanentlyDeleteArchivedAccount(access.supabase, 'store', storeId);

    if (body.action === 'archive') {
      const { data, error } = await access.supabase.rpc('archive_store_from_site', { p_store_id: storeId });
      if (error) {
        if (error.code === '42501') {
          return NextResponse.json({ error: 'admin_required' }, { status: 403 });
        }
        if (error.code === 'P0002') {
          return NextResponse.json({ error: 'store_not_found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'archive_failed' }, { status: 400 });
      }
      return NextResponse.json({ archived: data });
    }

    if (body.action === 'restore') {
      const { data, error } = await access.supabase.rpc('restore_archived_store', { p_store_id: storeId });
      if (error) {
        if (error.code === '23514' && error.message.includes('stores_account_purge_requires_archive')) {
          return NextResponse.json({ error: 'account_purge_in_progress' }, { status: 409 });
        }
        if (error.message.includes('store_not_archived')) {
          return NextResponse.json({ error: 'store_not_archived' }, { status: 409 });
        }
        return NextResponse.json({ error: 'restore_failed' }, { status: 400 });
      }
      return NextResponse.json({ restored: data });
    }

    if (body.action !== undefined || (decision !== 'approve' && decision !== 'reject')) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const { data, error } = await access.supabase.rpc('review_store_application', {
      p_store_id: storeId,
      p_decision: decision,
    });
    if (error) {
      if (error.message.includes('self_review_forbidden')) {
        return NextResponse.json({ error: 'self_review_forbidden' }, { status: 403 });
      }
      if (error.message.includes('application_not_found')) {
        return NextResponse.json({ error: 'application_not_found' }, { status: 404 });
      }
      if (error.message.includes('application_not_pending')) {
        return NextResponse.json({ error: 'application_not_pending' }, { status: 409 });
      }
      return NextResponse.json({ error: 'review_failed' }, { status: 400 });
    }
    return NextResponse.json({ review: data });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
