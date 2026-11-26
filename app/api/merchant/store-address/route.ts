import { storeContactNumber } from '@/lib/whatsapp';
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }

  const payload: unknown = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { store_id, address_ar, address_en, phone, whatsapp } = payload as Record<string, unknown>;
  if (typeof store_id !== 'string' || !uuidPattern.test(store_id)) {
    return NextResponse.json({ error: 'invalid_store' }, { status: 400 });
  }

  const addresses: { address_ar?: string; address_en?: string } = {};
  for (const [key, value] of [['address_ar', address_ar], ['address_en', address_en]] as const) {
    if (value === undefined) continue;
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 240) {
      return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
    }
    addresses[key] = value.trim();
  }
  const updates: { address_ar?: string; address_en?: string; phone?: string | null; whatsapp?: string | null } = { ...addresses };
  if (phone !== undefined || whatsapp !== undefined) {
    const value = phone !== undefined ? phone : whatsapp;
    const number = typeof value === 'string' ? storeContactNumber(value) : '';
    if (value !== null && !number) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    }
    updates.phone = number || null;
    updates.whatsapp = number ? number.slice(1) : null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });

    const { data: membership, error: membershipError } = await supabase
      .from('store_members')
      .select('member_role')
      .eq('store_id', store_id)
      .eq('profile_id', user.id)
      .maybeSingle();
    if (membershipError) return NextResponse.json({ error: 'membership_unavailable' }, { status: 503 });
    if (!membership || !['owner', 'manager'].includes(membership.member_role)) {
      return NextResponse.json({ error: 'store_access_denied' }, { status: 403 });
    }

    const { data, error } = await supabase.from('stores')
      .update(updates)
      .eq('id', store_id)
      .select('address_ar,address_en,phone,whatsapp')
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'address_not_saved' }, { status: 503 });
    if (!data) return NextResponse.json({ error: 'store_not_found' }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
