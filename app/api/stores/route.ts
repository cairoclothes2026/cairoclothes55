import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { storeContactNumber } from '@/lib/whatsapp';
import { parseMapLocation } from '@/lib/map-location';

type StoreApplication = {
  name_ar?: unknown;
  name_en?: unknown;
  area_id?: unknown;
  phone?: unknown;
  contact_name?: unknown;
  address_ar?: unknown;
  address_en?: unknown;
  location_url?: unknown;
  description_ar?: unknown;
  description_en?: unknown;
  consent?: unknown;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function slugBase(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const body = payload as StoreApplication;

  const nameAr = cleanText(body.name_ar);
  const nameEn = cleanText(body.name_en);
  const areaId = cleanText(body.area_id);
  const phone = storeContactNumber(cleanText(body.phone));
  const contactName = cleanText(body.contact_name);
  const addressAr = cleanText(body.address_ar);
  const addressEn = cleanText(body.address_en);
  const locationUrl = parseMapLocation(body.location_url);
  const descriptionAr = cleanText(body.description_ar);
  const descriptionEn = cleanText(body.description_en);

  if (!nameAr || !nameEn || !areaId || !cleanText(body.phone) || !contactName || !addressAr || !addressEn || body.consent !== true
    || nameAr.length > 120 || nameEn.length > 120 || areaId.length > 80 || contactName.length > 120
    || addressAr.length > 240 || addressEn.length > 240 || descriptionAr.length > 500 || descriptionEn.length > 500 || locationUrl === false) {
    return NextResponse.json({ error: 'required_fields_missing' }, { status: 400 });
  }
  if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) return NextResponse.json({ error: 'account_type_unavailable' }, { status: 503 });
    if (profile?.account_type !== 'merchant') return NextResponse.json({ error: 'account_type_conflict' }, { status: 403 });

    const { data: area, error: areaError } = await supabase.from('areas').select('id').eq('id', areaId).eq('active', true).maybeSingle();
    if (areaError || !area) return NextResponse.json({ error: 'invalid_area' }, { status: 400 });

    const nameSlug = slugBase(nameEn) || 'cairo-store';
    const slug = `${nameSlug}-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await supabase.rpc('submit_store_application', {
      p_slug: slug,
      p_name_ar: nameAr,
      p_name_en: nameEn,
      p_area_id: areaId,
      p_address_ar: addressAr,
      p_address_en: addressEn,
      p_contact_name: contactName,
      p_phone: phone,
      p_description_ar: descriptionAr,
      p_description_en: descriptionEn,
      p_consent: true,
    });

    if (error) return NextResponse.json({ error: 'application_not_saved' }, { status: 400 });
    let locationSaved = true;
    if (locationUrl && data?.id) {
      const { error: locationError } = await supabase.from('stores').update({ location_url: locationUrl }).eq('id', data.id);
      locationSaved = !locationError;
    }
    return NextResponse.json({ application: data, locationSaved }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
