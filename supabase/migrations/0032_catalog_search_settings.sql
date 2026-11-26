create table public.catalog_search_settings (
  id smallint primary key check (id = 1),
  weekly_limit boolean not null default true,
  hide_guest_search boolean not null default true
);
insert into public.catalog_search_settings (id) values (1);
alter table public.catalog_search_settings enable row level security;
revoke all on public.catalog_search_settings from public, anon, authenticated;
grant select on public.catalog_search_settings to anon, authenticated;
grant update (weekly_limit, hide_guest_search) on public.catalog_search_settings to authenticated;
create policy read_search_settings on public.catalog_search_settings for select to anon, authenticated using (true);
create policy admin_update_search_settings on public.catalog_search_settings for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

create or replace function search_quota.check_search(p_request uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  local_day date := (now() at time zone 'Africa/Cairo')::date;
  week date := local_day - ((extract(dow from local_day)::int + 1) % 7);
  usage_row search_quota.weekly_usage%rowtype;
  allowed boolean := true;
begin
  if actor is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if not (select weekly_limit from public.catalog_search_settings where id = 1) then
    return jsonb_build_object('allowed', true, 'remaining', null);
  end if;
  if p_request is null then
    select * into usage_row from search_quota.weekly_usage where account_id = actor and week_start = week;
  else
    insert into search_quota.weekly_usage(account_id, week_start) values (actor, week)
      on conflict (account_id) do nothing;
    select * into strict usage_row from search_quota.weekly_usage where account_id = actor for update;
    if usage_row.week_start < week then
      usage_row.requests := '{}';
    end if;
    if usage_row.week_start > week then
      allowed := false;
    elsif p_request = any(usage_row.requests) then
      allowed := true;
    elsif cardinality(usage_row.requests) < 5 then
      usage_row.requests := array_append(usage_row.requests, p_request);
      update search_quota.weekly_usage set week_start = week, requests = usage_row.requests where account_id = actor;
    else
      allowed := false;
    end if;
  end if;
  return jsonb_build_object('allowed', allowed, 'remaining', 5 - coalesce(cardinality(usage_row.requests), 0));
end;
$$;
