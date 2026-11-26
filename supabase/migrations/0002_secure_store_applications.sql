-- Record the store applicant's consent and limit which columns a signed-in user
-- can set during submission. The status remains the database default: pending.
alter table public.stores
  add column if not exists consent_at timestamptz,
  add column if not exists consent_version text;

revoke insert on public.stores from anon, authenticated;

create or replace function public.submit_store_application(
  p_slug text,
  p_name_ar text,
  p_name_en text,
  p_area_id text,
  p_address_ar text,
  p_address_en text,
  p_contact_name text,
  p_phone text,
  p_description_ar text,
  p_description_en text,
  p_consent boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_application public.stores;
begin
  if v_owner_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_consent is distinct from true then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) > 80 then
    raise exception 'invalid_slug' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_name_ar, ''))) not between 1 and 120
    or length(btrim(coalesce(p_name_en, ''))) not between 1 and 120
    or length(btrim(coalesce(p_contact_name, ''))) not between 1 and 120
    or length(btrim(coalesce(p_address_ar, ''))) not between 1 and 240
    or length(btrim(coalesce(p_address_en, ''))) not between 1 and 240
    or length(btrim(coalesce(p_area_id, ''))) not between 1 and 80 then
    raise exception 'required_fields_missing' using errcode = '22023';
  end if;
  if p_phone is null or length(btrim(p_phone)) not between 7 and 30 or btrim(p_phone) !~ '^[+0-9() .-]{7,30}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if length(coalesce(p_description_ar, '')) > 500 or length(coalesce(p_description_en, '')) > 500 then
    raise exception 'description_too_long' using errcode = '22023';
  end if;
  if not exists (select 1 from public.areas where id = p_area_id and active) then
    raise exception 'invalid_area' using errcode = '22023';
  end if;

  insert into public.stores (
    owner_id, slug, name_ar, name_en, area_id, address_ar, address_en,
    contact_name, phone, description_ar, description_en, consent_at, consent_version
  ) values (
    v_owner_id, p_slug, btrim(p_name_ar), btrim(p_name_en), btrim(p_area_id),
    btrim(p_address_ar), btrim(p_address_en), btrim(p_contact_name), btrim(p_phone),
    nullif(btrim(coalesce(p_description_ar, '')), ''),
    nullif(btrim(coalesce(p_description_en, '')), ''),
    now(), 'merchant-application-2026-11-05-v1'
  ) returning * into v_application;

  return jsonb_build_object('id', v_application.id, 'slug', v_application.slug, 'status', v_application.status);
end;
$$;

revoke all on function public.submit_store_application(text,text,text,text,text,text,text,text,text,text,boolean) from public, anon;
grant execute on function public.submit_store_application(text,text,text,text,text,text,text,text,text,text,boolean) to authenticated;
