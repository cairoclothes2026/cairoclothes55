import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
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

  const body = payload as { store_id?: unknown; name_ar?: unknown; name_en?: unknown };
  const storeId = typeof body.store_id === 'string' ? body.store_id : '';
  const nameAr = typeof body.name_ar === 'string' ? body.name_ar.trim() : '';
  const nameEn = typeof body.name_en === 'string' ? body.name_en.trim() : '';
  if (!uuidPattern.test(storeId) || (!nameAr && !nameEn) || nameAr.length > 120 || nameEn.length > 120) {
    return NextResponse.json({ error: 'invalid_store_name' }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });

    const { data: membership, error: membershipError } = await supabase
      .from('store_members')
      .select('member_role')
      .eq('store_id', storeId)
      .eq('profile_id', user.id)
      .maybeSingle();
    if (membershipError) return NextResponse.json({ error: 'membership_unavailable' }, { status: 503 });
    if (!membership || membership.member_role !== 'owner') {
      return NextResponse.json({ error: 'store_owner_required' }, { status: 403 });
    }

    const { data: existingStore, error: readError } = await supabase
      .from('stores')
      .select('name_ar,name_en')
      .eq('id', storeId)
      .maybeSingle();
    if (readError) return NextResponse.json({ error: 'store_unavailable' }, { status: 503 });
    if (!existingStore) return NextResponse.json({ error: 'store_not_found' }, { status: 404 });

    const { data, error: updateError } = await supabase
      .from('stores')
      .update({ name_ar: nameAr || existingStore.name_ar, name_en: nameEn || existingStore.name_en })
      .eq('id', storeId)
      .select('name_ar,name_en')
      .maybeSingle();
    if (updateError) return NextResponse.json({ error: 'store_name_not_saved' }, { status: 503 });
    if (!data) return NextResponse.json({ error: 'store_name_not_saved' }, { status: 503 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
