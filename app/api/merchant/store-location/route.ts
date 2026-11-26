import { NextResponse, type NextRequest } from 'next/server';
import { mapCoordinates, parseMapLocation } from '@/lib/map-location';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolvePin(location: string | null) {
  if (!location) return null;
  let url = new URL(location);
  for (let hop = 0; hop < 4; hop++) {
    const coords = mapCoordinates(url.href);
    if (coords) return coords;
    const shortLink = (url.hostname === 'maps.app.goo.gl' && /^\/[a-zA-Z0-9]+$/.test(url.pathname))
      || (url.hostname === 'goo.gl' && /^\/maps\/[a-zA-Z0-9]+$/.test(url.pathname));
    if (!shortLink || url.port) break;
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(3000) });
      const next = response.headers.get('location');
      if (!next || ![301,302,303,307,308].includes(response.status)) break;
      const safe = parseMapLocation(new URL(next, url).href);
      if (!safe) break;
      url = new URL(safe);
    } catch { break; }
  }
  return null;
}

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
  const body = payload as { store_id?: unknown; location_url?: unknown };
  const storeId = typeof body.store_id === 'string' ? body.store_id : '';
  const locationUrl = parseMapLocation(body.location_url);
  if (!uuidPattern.test(storeId) || locationUrl === false) {
    return NextResponse.json({ error: 'invalid_location' }, { status: 400 });
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
    if (!membership || !['owner', 'manager'].includes(membership.member_role)) {
      return NextResponse.json({ error: 'store_access_denied' }, { status: 403 });
    }

    const coords = await resolvePin(locationUrl);
    // An unchanged link can already have a verified pin (including a place-ID link).
    const {data: previous, error: readError} = await supabase.from('stores')
      .select('location_url,latitude,longitude').eq('id',storeId).single();
    if (readError) return NextResponse.json({error:'location_not_saved'},{status:503});
    const pin = coords ?? (previous.location_url === locationUrl && locationUrl ? previous : null);
    const { error: updateError } = await supabase.from('stores').update({
      location_url: locationUrl, latitude: pin?.latitude ?? null, longitude: pin?.longitude ?? null,
    }).eq('id', storeId);
    if (updateError) return NextResponse.json({ error: 'location_not_saved' }, { status: 503 });
    return NextResponse.json({ location_url: locationUrl });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
