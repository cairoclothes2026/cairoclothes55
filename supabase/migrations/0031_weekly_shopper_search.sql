create schema if not exists search_quota;
revoke all on schema search_quota from public, anon, authenticated;
grant usage on schema search_quota to authenticated;

create table search_quota.weekly_usage (
  account_id uuid primary key references public.profiles(id) on delete cascade,
  week_start date not null,
  requests uuid[] not null default '{}',
  check (cardinality(requests) <= 5)
);
alter table search_quota.weekly_usage enable row level security;
revoke all on search_quota.weekly_usage from public, anon, authenticated;

create function search_quota.check_search(p_request uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  metered boolean;
  local_day date := (now() at time zone 'Africa/Cairo')::date;
  week date := local_day - ((extract(dow from local_day)::int + 1) % 7);
  usage_row search_quota.weekly_usage%rowtype;
  allowed boolean := true;
begin
  select account_type = 'customer' and role is distinct from 'admin' into strict metered
    from public.profiles where id = actor;
  if not metered then
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
create function public.weekly_shopper_search(p_request uuid default null) returns jsonb
language sql security invoker set search_path = '' as $$
  select search_quota.check_search(p_request)
$$;
revoke all on function search_quota.check_search(uuid), public.weekly_shopper_search(uuid) from public, anon;
grant execute on function search_quota.check_search(uuid), public.weekly_shopper_search(uuid) to authenticated;
