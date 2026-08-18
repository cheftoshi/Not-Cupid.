-- Love monetization V2: profiles and replies remain free. Each rolling roster
-- cycle includes three distinct outgoing picks; additional picks are one-time
-- $0.99 extra connections (or included with Pro). The recipient never pays.

alter table public.users
  add column if not exists love_pick_cycle_at timestamptz;

create table if not exists public.love_connection_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  intended_candidate_id uuid references public.users(id) on delete set null,
  roster_cycle_at timestamptz not null,
  stripe_session_id text not null unique,
  stripe_payment_id text not null unique,
  amount_cents integer not null default 99 check (amount_cents between 1 and 100000),
  status text not null default 'purchased' check (status in ('purchased', 'credit', 'consumed', 'refunded')),
  match_id uuid unique references public.matches(id) on delete set null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists love_connection_unlocks_user_status_idx
  on public.love_connection_unlocks (user_id, status, created_at desc);
alter table public.love_connection_unlocks enable row level security;
revoke all on table public.love_connection_unlocks from public, anon, authenticated;
grant all on table public.love_connection_unlocks to service_role;

create table if not exists public.love_pick_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  candidate_id uuid not null references public.users(id) on delete cascade,
  roster_cycle_at timestamptz not null,
  access_type text not null check (access_type in ('included', 'paid', 'pro')),
  status text not null default 'created' check (status in ('created', 'returned')),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  unlock_id uuid unique references public.love_connection_unlocks(id) on delete set null,
  created_at timestamptz not null default now(),
  returned_at timestamptz,
  unique (user_id, candidate_id)
);

create index if not exists love_pick_ledger_cycle_idx
  on public.love_pick_ledger (user_id, roster_cycle_at, access_type, status);
alter table public.love_pick_ledger enable row level security;
revoke all on table public.love_pick_ledger from public, anon, authenticated;
grant all on table public.love_pick_ledger to service_role;

-- Existing monetization rows remain valid; love_profile is retained only as a
-- historical product key while new Love revenue uses love_connection.
alter table public.monetization_events
  drop constraint if exists monetization_events_product_check;
alter table public.monetization_events
  add constraint monetization_events_product_check
  check (product in ('love_profile', 'love_connection', 'friend_pack', 'pro'));

create or replace function public.ensure_love_pick_cycle(p_user_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $function$
declare v_cycle timestamptz; v_roster_cycle timestamptz;
begin
  if p_user_id is null then return null; end if;
  select u.love_pick_cycle_at, u.roster_refreshed_at into v_cycle, v_roster_cycle
  from public.users u where u.id = p_user_id for update;
  if not found then return null; end if;
  -- A genuine roster rotation starts a fresh included allowance. Backfills do
  -- not change roster_refreshed_at, so they cannot be used to reset the quota.
  if v_roster_cycle is not null and (v_cycle is null or v_roster_cycle > v_cycle) then
    v_cycle := v_roster_cycle;
  end if;
  if v_cycle is null or v_cycle <= pg_catalog.clock_timestamp() - interval '24 hours' then
    v_cycle := pg_catalog.clock_timestamp();
  end if;
  update public.users set love_pick_cycle_at = v_cycle
    where id = p_user_id and love_pick_cycle_at is distinct from v_cycle;
  return v_cycle;
end;
$function$;

create or replace function public.create_love_pick(
  p_picker_id uuid,
  p_candidate_id uuid,
  p_compatibility_score integer,
  p_expires_at timestamptz,
  p_max_connections integer,
  p_access_type text,
  p_unlock_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_match_id uuid;
  v_user_count integer;
  v_picker_live integer;
  v_candidate_live integer;
  v_cycle timestamptz;
  v_included_used integer;
  v_pro_until timestamptz;
  v_roster_cycle timestamptz;
begin
  if p_picker_id is null or p_candidate_id is null or p_picker_id = p_candidate_id
    or p_max_connections is null or p_max_connections < 1 or p_max_connections > 10
    or p_access_type not in ('included', 'paid', 'pro') then return null; end if;

  perform u.id from public.users u
    where u.id in (p_picker_id, p_candidate_id) order by u.id for update;
  select count(*) into v_user_count from public.users u
    where u.id in (p_picker_id, p_candidate_id) and u.deleted_at is null;
  if v_user_count <> 2 then return null; end if;

  select u.love_pick_cycle_at, u.roster_refreshed_at, u.friend_pro_until
  into v_cycle, v_roster_cycle, v_pro_until
  from public.users u where u.id = p_picker_id;
  if v_roster_cycle is not null and (v_cycle is null or v_roster_cycle > v_cycle) then
    v_cycle := v_roster_cycle;
  end if;
  if v_cycle is null or v_cycle <= pg_catalog.clock_timestamp() - interval '24 hours' then
    v_cycle := pg_catalog.clock_timestamp();
  end if;
  update public.users set love_pick_cycle_at = v_cycle
    where id = p_picker_id and love_pick_cycle_at is distinct from v_cycle;

  select
    count(*) filter (where m.user_1_id = p_picker_id or m.user_2_id = p_picker_id),
    count(*) filter (where m.user_1_id = p_candidate_id or m.user_2_id = p_candidate_id)
  into v_picker_live, v_candidate_live from public.matches m
  where m.ended_at is null and m.status not in ('ended', 'passed', 'expired')
    and ((coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false))
      or m.expires_at is null or m.expires_at >= pg_catalog.clock_timestamp())
    and (m.user_1_id in (p_picker_id, p_candidate_id) or m.user_2_id in (p_picker_id, p_candidate_id));
  if v_picker_live >= p_max_connections or v_candidate_live >= p_max_connections then return null; end if;

  if exists (
    select 1 from public.matches m
    where m.ended_at is null and m.status not in ('ended', 'passed', 'expired')
      and ((coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false))
        or m.expires_at is null or m.expires_at >= pg_catalog.clock_timestamp())
      and ((m.user_1_id = p_picker_id and m.user_2_id = p_candidate_id)
        or (m.user_1_id = p_candidate_id and m.user_2_id = p_picker_id))
  ) then return null; end if;
  if exists (
    select 1 from public.match_history h
    where h.user_a_id = least(p_picker_id, p_candidate_id)
      and h.user_b_id = greatest(p_picker_id, p_candidate_id)
  ) then return null; end if;

  if p_access_type = 'included' then
    select count(*) into v_included_used from public.love_pick_ledger l
    where l.user_id = p_picker_id and l.roster_cycle_at = v_cycle
      and l.access_type = 'included' and l.status <> 'returned';
    if v_included_used >= 3 then return null; end if;
  elsif p_access_type = 'pro' then
    if v_pro_until is null or v_pro_until <= pg_catalog.clock_timestamp() then return null; end if;
  else
    if p_unlock_id is null then return null; end if;
    perform u.id from public.love_connection_unlocks u
    where u.id = p_unlock_id and u.user_id = p_picker_id
      and u.status in ('purchased', 'credit')
      and (u.intended_candidate_id is null or u.intended_candidate_id = p_candidate_id)
    for update;
    if not found then return null; end if;
  end if;

  insert into public.matches (user_1_id, user_2_id, compatibility_score, status, expires_at)
  values (p_picker_id, p_candidate_id, greatest(0, least(100, coalesce(p_compatibility_score, 0))), 'pending', p_expires_at)
  returning id into v_match_id;

  insert into public.love_pick_ledger
    (user_id, candidate_id, roster_cycle_at, access_type, match_id, unlock_id)
  values
    (p_picker_id, p_candidate_id, v_cycle, p_access_type, v_match_id,
      case when p_access_type = 'paid' then p_unlock_id else null end);

  if p_access_type = 'paid' then
    update public.love_connection_unlocks
      set intended_candidate_id = p_candidate_id, status = 'consumed', match_id = v_match_id,
          consumed_at = pg_catalog.clock_timestamp()
      where id = p_unlock_id;
  end if;

  update public.users set status = 'matched', last_matched_at = pg_catalog.clock_timestamp()
    where id in (p_picker_id, p_candidate_id);
  return v_match_id;
end;
$function$;

-- A declined or expired outgoing pick returns one included pick. A user ending
-- their own connection never replenishes the cycle; blocking/reporting itself
-- remains immediate and unrestricted.
create or replace function public.return_included_love_pick(
  p_match_id uuid,
  p_decliner_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare v_ledger public.love_pick_ledger%rowtype;
begin
  select * into v_ledger from public.love_pick_ledger l
  where l.match_id = p_match_id and l.access_type = 'included' and l.status = 'created'
  for update;
  if not found then return false; end if;
  -- Null means a system expiry. An explicit decline returns the pick only when
  -- it came from the recipient, never when the original picker changed course.
  if p_decliner_id is not null and p_decliner_id = v_ledger.user_id then return false; end if;
  update public.love_pick_ledger
    set status = 'returned', returned_at = pg_catalog.clock_timestamp()
    where id = v_ledger.id;
  return true;
end;
$function$;

-- Preserve the 24-hour roster clock while removing the newly-created pair and
-- backfilling saturated candidates. The old implementation nulled the clock on
-- every pick, which would accidentally reset the three-pick allowance.
create or replace function public.sync_match_rosters(p_user_ids uuid[], p_max_connections integer)
returns integer language plpgsql security invoker set search_path = '' as $function$
declare v_user_ids_text text[]; v_saturated_ids text[]; v_rows integer;
begin
  if p_user_ids is null or cardinality(p_user_ids) = 0 or cardinality(p_user_ids) > 10
    or p_max_connections is null or p_max_connections < 1 or p_max_connections > 10 then return 0; end if;
  select coalesce(array_agg(distinct participant_id::text), '{}'::text[]) into v_user_ids_text
    from unnest(p_user_ids) as participants(participant_id);
  select coalesce(array_agg(participant_id::text), '{}'::text[]) into v_saturated_ids
    from unnest(p_user_ids) as participants(participant_id)
    where (select count(*) from public.matches m
      where m.ended_at is null and m.status not in ('ended', 'passed', 'expired')
        and ((coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false))
          or m.expires_at is null or m.expires_at >= pg_catalog.clock_timestamp())
        and (m.user_1_id = participant_id or m.user_2_id = participant_id)) >= p_max_connections;
  update public.users u set roster_snapshot = array(
      select candidate_id from unnest(coalesce(u.roster_snapshot, '{}'::text[])) as roster(candidate_id)
      where not ((u.id = any(p_user_ids) and candidate_id = any(v_user_ids_text))
        or candidate_id = any(v_saturated_ids)))
    where u.id = any(p_user_ids) or coalesce(u.roster_snapshot, '{}'::text[]) && v_saturated_ids;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

revoke all on function public.ensure_love_pick_cycle(uuid) from public, anon, authenticated;
revoke all on function public.create_love_pick(uuid, uuid, integer, timestamptz, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.return_included_love_pick(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sync_match_rosters(uuid[], integer) from public, anon, authenticated;
grant execute on function public.ensure_love_pick_cycle(uuid) to service_role;
grant execute on function public.create_love_pick(uuid, uuid, integer, timestamptz, integer, text, uuid) to service_role;
grant execute on function public.return_included_love_pick(uuid, uuid) to service_role;
grant execute on function public.sync_match_rosters(uuid[], integer) to service_role;
