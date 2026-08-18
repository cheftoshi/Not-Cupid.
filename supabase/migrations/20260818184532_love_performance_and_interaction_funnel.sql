-- Love Line performance, interaction, and responsiveness hardening.
-- Everything is additive or a compatible function replacement so the old and
-- new deployments can serve traffic while this migration lands.

create table if not exists public.app_client_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_name text not null,
  path text,
  surface text,
  match_id uuid references public.matches(id) on delete set null,
  candidate_id uuid references public.users(id) on delete set null,
  metric_name text,
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 600000),
  metric_value double precision,
  rating text check (rating is null or rating in ('good', 'needs-improvement', 'poor')),
  device_class text check (device_class is null or device_class in ('phone', 'tablet', 'desktop', 'unknown')),
  display_mode text check (display_mode is null or display_mode in ('standalone', 'minimal-ui', 'fullscreen', 'browser', 'unknown')),
  session_id text,
  dedupe_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_client_events_name_created_idx
  on public.app_client_events (event_name, created_at desc);
create index if not exists app_client_events_user_created_idx
  on public.app_client_events (user_id, created_at desc)
  where user_id is not null;
create index if not exists app_client_events_match_created_idx
  on public.app_client_events (match_id, created_at desc)
  where match_id is not null;

alter table public.app_client_events enable row level security;
revoke all on table public.app_client_events from public, anon, authenticated;
grant select, insert, update, delete on table public.app_client_events to service_role;

-- Keep a client-generated message id so retrying after a lost network response
-- returns the original message instead of posting it twice.
alter table public.messages add column if not exists client_id text;
create unique index if not exists messages_sender_client_id_uidx
  on public.messages (sender_id, client_id)
  where client_id is not null;

-- The hot roster filters are partial and only need currently eligible rows.
create index if not exists users_love_pool_eligible_idx
  on public.users (is_test, pool_active, ignored_picks, id)
  where pool_active = true and is_blocked = false
    and matching_disabled_at is null and deleted_at is null;
create index if not exists matches_mutual_no_message_due_idx
  on public.matches (created_at, id)
  where status = 'both_accepted' and ended_at is null;

-- The 12-hour mutual/no-message nudge is implemented behind an explicit
-- version gate in application code. Adding the type here does not deliver it.
alter table public.love_notification_events
  drop constraint if exists love_notification_events_notification_type_check;
alter table public.love_notification_events
  add constraint love_notification_events_notification_type_check
  check (notification_type in (
    'interest_immediate', 'decision_24h', 'decision_final',
    'mutual', 'mutual_no_message_12h', 'expired'
  ));

create or replace function public.claim_love_notification_event(
  p_match_id uuid,
  p_recipient_id uuid,
  p_notification_type text,
  p_channel text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_notification_type not in (
    'interest_immediate', 'decision_24h', 'decision_final',
    'mutual', 'mutual_no_message_12h', 'expired'
  ) or p_channel not in ('email', 'push', 'in_app') then
    raise exception 'invalid Love notification event';
  end if;

  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and p_recipient_id in (m.user_1_id, m.user_2_id)
  ) then
    raise exception 'recipient is not a match participant';
  end if;

  insert into public.love_notification_events (
    match_id, recipient_id, notification_type, channel
  ) values (
    p_match_id, p_recipient_id, p_notification_type, p_channel
  )
  on conflict (match_id, recipient_id, notification_type, channel) do update
    set status = 'claimed',
        claimed_at = now(),
        sent_at = null,
        delivered_at = null,
        opened_at = null,
        clicked_at = null,
        failed_at = null,
        last_event_at = now(),
        provider_id = null,
        error_code = null
    where love_notification_events.status = 'failed'
      and love_notification_events.claimed_at < now() - interval '30 minutes'
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.claim_love_notification_event(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_love_notification_event(uuid, uuid, text, text)
  to service_role;

-- Replace the atomic Love pick claim with an incoming-decision ceiling. The
-- candidate may still have active mutual chats, but cannot receive a fourth
-- unanswered incoming choice until one is decided or expires.
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
  v_candidate_pending_incoming integer;
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
    count(*) filter (where m.user_1_id = p_candidate_id or m.user_2_id = p_candidate_id),
    count(*) filter (
      where m.status = 'pending'
        and ((m.user_1_id = p_candidate_id and not coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false))
          or (m.user_2_id = p_candidate_id and not coalesce(m.user_2_accepted, false) and coalesce(m.user_1_accepted, false)))
    )
  into v_picker_live, v_candidate_live, v_candidate_pending_incoming
  from public.matches m
  where m.ended_at is null and m.status not in ('ended', 'passed', 'expired')
    and ((coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false))
      or m.expires_at is null or m.expires_at >= pg_catalog.clock_timestamp())
    and (m.user_1_id in (p_picker_id, p_candidate_id) or m.user_2_id in (p_picker_id, p_candidate_id));
  if v_picker_live >= p_max_connections or v_candidate_live >= p_max_connections
    or v_candidate_pending_incoming >= 3 then return null; end if;

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

revoke all on function public.create_love_pick(uuid, uuid, integer, timestamptz, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_love_pick(uuid, uuid, integer, timestamptz, integer, text, uuid)
  to service_role;

-- Server-side funnel facts are atomic with the underlying write and do not
-- depend on a browser beacon surviving navigation or a weak connection.
create or replace function public.log_love_pick_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_client_events (
    user_id, event_name, surface, match_id, candidate_id, dedupe_key, metadata
  ) values (
    new.user_id, 'pick_success', 'love_roster', new.match_id, new.candidate_id,
    'love-pick:' || new.id::text,
    jsonb_build_object('access_type', new.access_type)
  ) on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function public.log_love_pick_event()
  from public, anon, authenticated;

drop trigger if exists love_pick_event_trigger on public.love_pick_ledger;
create trigger love_pick_event_trigger
  after insert on public.love_pick_ledger
  for each row execute function public.log_love_pick_event();

create or replace function public.log_love_message_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prior_count integer;
  v_prior_other boolean;
  v_event_name text;
begin
  select count(*), coalesce(bool_or(m.sender_id <> new.sender_id), false)
  into v_prior_count, v_prior_other
  from public.messages m
  where m.match_id = new.match_id and m.id <> new.id;

  v_event_name := case
    when v_prior_count = 0 then 'first_message'
    when v_prior_other and not exists (
      select 1 from public.messages own
      where own.match_id = new.match_id and own.sender_id = new.sender_id and own.id <> new.id
    ) then 'reply'
    else 'message_sent'
  end;

  insert into public.app_client_events (
    user_id, event_name, surface, match_id, dedupe_key
  ) values (
    new.sender_id, v_event_name, 'love_chat', new.match_id,
    'love-message:' || new.id::text
  ) on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function public.log_love_message_event()
  from public, anon, authenticated;

drop trigger if exists love_message_event_trigger on public.messages;
create trigger love_message_event_trigger
  after insert on public.messages
  for each row execute function public.log_love_message_event();

-- Aggregate in Postgres so the admin dashboard never hits Supabase's row
-- response ceiling while calculating percentiles.
create or replace function public.app_experience_summary(p_since timestamptz)
returns table (
  event_name text,
  metric_name text,
  total bigint,
  unique_users bigint,
  p75_duration_ms double precision,
  p75_metric_value double precision
)
language sql
security definer
set search_path = public
as $$
  select
    e.event_name,
    e.metric_name,
    count(*)::bigint,
    count(distinct e.user_id)::bigint,
    (percentile_cont(0.75) within group (order by e.duration_ms)
      filter (where e.duration_ms is not null))::double precision,
    (percentile_cont(0.75) within group (order by e.metric_value)
      filter (where e.metric_value is not null))::double precision
  from public.app_client_events e
  left join public.users u on u.id = e.user_id
  where e.created_at >= p_since
    and (e.user_id is null or (u.is_test is not true and u.deleted_at is null))
  group by e.event_name, e.metric_name
  order by e.event_name, e.metric_name;
$$;

revoke all on function public.app_experience_summary(timestamptz)
  from public, anon, authenticated;
grant execute on function public.app_experience_summary(timestamptz)
  to service_role;
