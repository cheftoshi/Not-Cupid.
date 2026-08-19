-- Keep unsafe/deactivated accounts out of live Dating Experiment state, and
-- create each reciprocal shortlist as one all-or-nothing transaction.

create or replace function public.enforce_dating_experiment_participant_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status <> 'withdrawn' and not exists (
    select 1
    from public.users u
    where u.id = new.user_id
      and u.is_test is not true
      and u.is_blocked is not true
      and u.deleted_at is null
  ) then
    raise exception 'participant is not eligible for a live dating experiment';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_dating_experiment_participant_eligibility()
  from public, anon, authenticated;
grant execute on function public.enforce_dating_experiment_participant_eligibility()
  to service_role;
drop trigger if exists enforce_dating_experiment_participant_eligibility on public.raffle_entries;
create trigger enforce_dating_experiment_participant_eligibility
before insert or update of user_id, status
on public.raffle_entries
for each row execute function public.enforce_dating_experiment_participant_eligibility();

create or replace function public.enforce_live_dating_experiment_pair()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.dating_experiment_rounds r
    where r.id = new.round_id and r.event_key = new.event_key
  ) then
    raise exception 'shortlist pair event must match its round';
  end if;
  if (
    select count(*)
    from public.users u
    where u.id in (new.user_a_id, new.user_b_id)
      and u.is_test is not true
      and u.is_blocked is not true
      and u.deleted_at is null
  ) <> 2 then
    raise exception 'ineligible accounts cannot enter live dating experiment shortlists';
  end if;
  return new;
end;
$function$;

create or replace function public.create_dating_experiment_shortlist_round(
  p_event_key text,
  p_round_number integer,
  p_response_deadline timestamptz,
  p_algorithm_version text,
  p_eligible_user_count integer,
  p_pairs jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_event public.dating_experiment_events%rowtype;
  v_round_id uuid;
  v_pair_count integer;
  v_inserted_count integer;
  v_participant_ids uuid[];
  v_updated_count integer;
begin
  if p_event_key is null
    or p_round_number is null or p_round_number < 1
    or p_response_deadline is null
    or nullif(btrim(p_algorithm_version), '') is null
    or p_eligible_user_count is null or p_eligible_user_count < 2
    or jsonb_typeof(p_pairs) <> 'array'
  then
    raise exception 'invalid dating experiment shortlist request';
  end if;

  v_pair_count := jsonb_array_length(p_pairs);
  if v_pair_count < 1 or v_pair_count > 800 then
    raise exception 'invalid dating experiment shortlist size';
  end if;

  select e.* into v_event
  from public.dating_experiment_events e
  where e.event_key = p_event_key
  for update;
  if not found
    or v_event.status not in ('entry_open', 'entry_closed', 'shortlisting')
    or p_algorithm_version is distinct from v_event.algorithm_version
  then
    raise exception 'dating experiment is not ready for shortlisting';
  end if;

  if exists (
    select 1 from public.dating_experiment_rounds r
    where r.event_key = p_event_key and r.status in ('collecting', 'resolving')
  ) then
    raise exception 'dating experiment already has an active shortlist round';
  end if;

  insert into public.dating_experiment_rounds (
    event_key, round_number, status, response_deadline, algorithm_version,
    eligible_user_count, offered_pair_count
  ) values (
    p_event_key, p_round_number, 'collecting', p_response_deadline,
    p_algorithm_version, p_eligible_user_count, v_pair_count
  ) returning id into v_round_id;

  insert into public.dating_experiment_shortlist_pairs (
    round_id, event_key, user_a_id, user_b_id, compatibility_score
  )
  select
    v_round_id,
    p_event_key,
    (pair->>'user_a_id')::uuid,
    (pair->>'user_b_id')::uuid,
    (pair->>'compatibility_score')::integer
  from jsonb_array_elements(p_pairs) as pair;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_pair_count then
    raise exception 'dating experiment shortlist pair insert was incomplete';
  end if;

  select array_agg(distinct participant_id) into v_participant_ids
  from (
    select (pair->>'user_a_id')::uuid as participant_id from jsonb_array_elements(p_pairs) pair
    union
    select (pair->>'user_b_id')::uuid as participant_id from jsonb_array_elements(p_pairs) pair
  ) participants;

  if exists (
    select 1
    from unnest(v_participant_ids) participant_id
    left join public.users u on u.id = participant_id
    where u.id is null or u.is_test is true or u.is_blocked is true or u.deleted_at is not null
  ) then
    raise exception 'shortlist contains an ineligible participant';
  end if;

  update public.raffle_entries e
  set attempts = e.attempts + 1,
      status = 'picked'
  where e.event_key = p_event_key
    and e.user_id = any(v_participant_ids)
    and e.status = 'entered'
    and e.terms_version = v_event.terms_version
    and e.attempts < v_event.max_attempts;
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> cardinality(v_participant_ids) then
    raise exception 'shortlist participant reservation was incomplete';
  end if;

  update public.dating_experiment_events e
  set status = 'shortlisting', updated_at = pg_catalog.clock_timestamp()
  where e.event_key = p_event_key;

  return v_round_id;
end;
$function$;

revoke all on function public.create_dating_experiment_shortlist_round(
  text, integer, timestamptz, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.create_dating_experiment_shortlist_round(
  text, integer, timestamptz, text, integer, jsonb
) to service_role;

create table if not exists public.dating_experiment_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null references public.dating_experiment_events(event_key) on delete cascade,
  draw_id uuid not null references public.raffle_draws(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('dinner_24h', 'dinner_3h')),
  channel text not null default 'push' check (channel = 'push'),
  status text not null default 'claimed' check (status in ('claimed', 'delivered', 'failed', 'skipped')),
  claimed_at timestamptz not null default now(),
  delivered_at timestamptz,
  updated_at timestamptz not null default now(),
  last_error text,
  unique (event_key, draw_id, user_id, notification_type, channel)
);
alter table public.dating_experiment_notification_deliveries enable row level security;
revoke all on table public.dating_experiment_notification_deliveries from anon, authenticated;
grant all on table public.dating_experiment_notification_deliveries to service_role;

-- The client and profile validators cap these short videos at 25 MB. Keep the
-- storage boundary identical so a signed upload URL cannot bypass the app cap.
update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']::text[]
where id = 'raffle-videos';

-- Client-generated ids make PWA/network retries safe for Friend chats.
alter table public.friend_messages add column if not exists client_id text;
create unique index if not exists friend_messages_sender_client_id_idx
  on public.friend_messages(sender_id, client_id) where client_id is not null;
alter table public.friend_activity_comments add column if not exists client_id text;
create unique index if not exists friend_activity_comments_user_client_id_idx
  on public.friend_activity_comments(user_id, client_id) where client_id is not null;
alter table public.friend_dms add column if not exists client_id text;
create unique index if not exists friend_dms_sender_client_id_idx
  on public.friend_dms(sender_id, client_id) where client_id is not null;
alter table public.friend_club_messages add column if not exists client_id text;
create unique index if not exists friend_club_messages_sender_client_id_idx
  on public.friend_club_messages(sender_id, client_id) where client_id is not null;

create or replace function public.set_friend_activity_rsvp(
  p_activity_id uuid,
  p_user_id uuid,
  p_response text
)
returns table (my_response text, yes_count integer, maybe_count integer, no_count integer, total_count integer)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_activity public.friend_activities%rowtype;
  v_existing text;
  v_response text;
begin
  if p_response not in ('yes', 'maybe', 'no') then
    raise exception 'invalid RSVP response';
  end if;
  select a.* into v_activity from public.friend_activities a where a.id = p_activity_id for update;
  if not found then raise exception 'activity not found'; end if;

  select r.response into v_existing
  from public.friend_activity_rsvps r
  where r.activity_id = p_activity_id and r.user_id = p_user_id
  for update;

  if v_existing is not distinct from p_response then
    delete from public.friend_activity_rsvps r
    where r.activity_id = p_activity_id and r.user_id = p_user_id;
    v_response := null;
  else
    if p_response = 'yes'
      and v_existing is distinct from 'yes'
      and v_activity.capacity is not null
      and (select count(*) from public.friend_activity_rsvps r where r.activity_id = p_activity_id and r.response = 'yes') >= v_activity.capacity
    then
      raise exception 'activity capacity reached';
    end if;
    insert into public.friend_activity_rsvps(activity_id, user_id, response)
    values (p_activity_id, p_user_id, p_response)
    on conflict (activity_id, user_id) do update set response = excluded.response;
    v_response := p_response;
  end if;

  return query
  select v_response,
    count(*) filter (where coalesce(r.response, 'yes') = 'yes')::integer,
    count(*) filter (where r.response = 'maybe')::integer,
    count(*) filter (where r.response = 'no')::integer,
    count(*)::integer
  from public.friend_activity_rsvps r
  where r.activity_id = p_activity_id;
end;
$function$;

revoke all on function public.set_friend_activity_rsvp(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_friend_activity_rsvp(uuid, uuid, text)
  to service_role;

-- One active crew per user remains the current product model. Repair any old
-- duplicate memberships, enforce it, and merge crews transactionally. Old
-- room messages stay in the archived source circle so newly merged people can
-- never inherit a conversation that happened before they joined.
with ranked as (
  select circle_id, user_id,
    row_number() over (partition by user_id order by joined_at desc, circle_id) as rn
  from public.friend_circle_members
  where left_at is null
)
update public.friend_circle_members m
set left_at = pg_catalog.clock_timestamp()
from ranked r
where m.circle_id = r.circle_id and m.user_id = r.user_id and r.rn > 1;

create unique index if not exists friend_circle_members_one_active_user_idx
  on public.friend_circle_members(user_id) where left_at is null;

create or replace function public.join_friend_circle(p_user_a_id uuid, p_user_b_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_circle_a uuid;
  v_circle_b uuid;
  v_circle uuid;
  v_merge_ids uuid[];
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_user_a_id is null or p_user_b_id is null or p_user_a_id = p_user_b_id then
    raise exception 'invalid friend circle participants';
  end if;
  perform u.id from public.users u
  where u.id in (p_user_a_id, p_user_b_id)
  order by u.id for update;
  if (select count(*) from public.users u where u.id in (p_user_a_id, p_user_b_id) and u.deleted_at is null and u.is_blocked is not true) <> 2 then
    raise exception 'friend circle participant unavailable';
  end if;
  if (select count(distinct u.is_test) from public.users u where u.id in (p_user_a_id, p_user_b_id)) <> 1 then
    raise exception 'friend circle realm mismatch';
  end if;

  select m.circle_id into v_circle_a from public.friend_circle_members m
  where m.user_id = p_user_a_id and m.left_at is null for update;
  select m.circle_id into v_circle_b from public.friend_circle_members m
  where m.user_id = p_user_b_id and m.left_at is null for update;

  if v_circle_a is not null and v_circle_b is not null and v_circle_a = v_circle_b then
    return v_circle_a;
  elsif v_circle_a is not null and v_circle_b is not null then
    v_circle := v_circle_a;
    select array_agg(m.user_id) into v_merge_ids
    from public.friend_circle_members m
    where m.circle_id = v_circle_b and m.left_at is null;
    update public.friend_circle_members m set left_at = v_now
    where m.circle_id = v_circle_b and m.left_at is null;
    insert into public.friend_circle_members(circle_id, user_id, joined_at, left_at)
    select v_circle, participant_id, v_now, null
    from unnest(coalesce(v_merge_ids, '{}'::uuid[])) participant_id
    on conflict (circle_id, user_id) do update set joined_at = excluded.joined_at, left_at = null;
    update public.friend_circle_members m set joined_at = v_now
    where m.circle_id = v_circle and m.left_at is null;
    update public.friend_connections c set circle_id = v_circle where c.circle_id = v_circle_b;
    return v_circle;
  elsif v_circle_a is not null or v_circle_b is not null then
    v_circle := coalesce(v_circle_a, v_circle_b);
    insert into public.friend_circle_members(circle_id, user_id, joined_at, left_at)
    values (v_circle, case when v_circle_a is null then p_user_a_id else p_user_b_id end, v_now, null)
    on conflict (circle_id, user_id) do update set joined_at = excluded.joined_at, left_at = null;
    return v_circle;
  end if;

  insert into public.friend_circles default values returning id into v_circle;
  insert into public.friend_circle_members(circle_id, user_id, joined_at)
  values (v_circle, p_user_a_id, v_now), (v_circle, p_user_b_id, v_now);
  return v_circle;
end;
$function$;

revoke all on function public.join_friend_circle(uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_friend_circle(uuid, uuid) to service_role;

-- Claim a Friend connection request under the pair-row lock. Simultaneous
-- picks can no longer leave both flags true while the room remains unopened.
create or replace function public.pick_friend_connection(
  p_user_id uuid,
  p_candidate_id uuid,
  p_compatibility_score integer
)
returns table (outcome text, circle_id uuid)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_a uuid := least(p_user_id, p_candidate_id);
  v_b uuid := greatest(p_user_id, p_candidate_id);
  v_connection public.friend_connections%rowtype;
  v_circle uuid;
  v_i_am_a boolean := p_user_id = v_a;
  v_i_picked boolean;
  v_they_picked boolean;
begin
  if p_user_id is null or p_candidate_id is null or p_user_id = p_candidate_id then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;
  select c.* into v_connection from public.friend_connections c
  where c.user_a_id = v_a and c.user_b_id = v_b
  for update;
  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;
  if v_connection.status = 'connected' then
    return query select 'connected'::text, v_connection.circle_id;
    return;
  end if;
  if v_connection.status = 'declined' then
    return query select 'declined'::text, null::uuid;
    return;
  end if;
  if v_connection.match_expires_at is not null
    and v_connection.match_expires_at < pg_catalog.clock_timestamp() then
    update public.friend_connections c set status = 'declined'
    where c.id = v_connection.id;
    return query select 'expired'::text, null::uuid;
    return;
  end if;

  v_i_picked := case when v_i_am_a then v_connection.a_picked else v_connection.b_picked end;
  v_they_picked := case when v_i_am_a then v_connection.b_picked else v_connection.a_picked end;
  if v_i_picked and not v_they_picked then
    return query select 'already_pending'::text, null::uuid;
    return;
  end if;

  update public.friend_connections c
  set a_picked = case when v_i_am_a then true else c.a_picked end,
      b_picked = case when v_i_am_a then c.b_picked else true end,
      compatibility_score = greatest(0, least(100, coalesce(p_compatibility_score, 0)))
  where c.id = v_connection.id
  returning c.* into v_connection;

  if v_connection.a_picked and v_connection.b_picked then
    v_circle := public.join_friend_circle(v_a, v_b);
    update public.friend_connections c
    set status = 'connected', circle_id = v_circle,
        connected_at = coalesce(c.connected_at, pg_catalog.clock_timestamp()),
        match_expires_at = null
    where c.id = v_connection.id;
    return query select 'connected'::text, v_circle;
    return;
  end if;

  return query select 'pending'::text, null::uuid;
end;
$function$;

revoke all on function public.pick_friend_connection(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.pick_friend_connection(uuid, uuid, integer)
  to service_role;
