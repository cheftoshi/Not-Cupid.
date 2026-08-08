-- Every Dating Experiment is a separate, bounded operational event. The event
-- row is the serialization point for entry capacity, while participant media,
-- preferences, choices, and outcomes remain isolated by event_key.

create table public.dating_experiment_events (
  event_key text primary key
    check (event_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(event_key) between 8 and 100),
  public_name text not null check (char_length(public_name) between 3 and 120),
  city text not null check (char_length(city) between 2 and 80),
  metro text not null check (metro ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  center_zip text not null check (center_zip ~ '^[0-9]{5}$'),
  radius_miles numeric(5,2) not null check (radius_miles > 0 and radius_miles <= 100),
  status text not null default 'draft'
    check (status in ('draft', 'entry_open', 'entry_closed', 'shortlisting', 'resolved', 'cancelled')),
  entry_cap integer not null check (entry_cap between 2 and 1000),
  shortlist_max_options integer not null check (shortlist_max_options between 1 and 2),
  winner_pair_limit integer not null check (winner_pair_limit between 1 and 2),
  max_attempts integer not null check (max_attempts between 1 and 3),
  response_hours integer not null check (response_hours between 1 and 72),
  prize_per_pair_cents integer not null default 0
    check (prize_per_pair_cents between 0 and 100000),
  max_prize_cents integer generated always as (prize_per_pair_cents * winner_pair_limit) stored,
  -- Selection is always payment-neutral. Any future paid ticketed product must
  -- use a different system and may not alter experiment entry or selection.
  entry_price_cents integer not null default 0 check (entry_price_cents = 0),
  selection_payment_neutral boolean not null default true check (selection_payment_neutral is true),
  terms_version text not null check (char_length(terms_version) between 3 and 100),
  algorithm_version text not null check (char_length(algorithm_version) between 3 and 100),
  minimum_pair_score integer not null check (minimum_pair_score between 0 and 100),
  winner_fulfillment_details text,
  entry_opens_at timestamptz not null,
  entry_closes_at timestamptz not null,
  happens_at timestamptz not null,
  prize_funding_confirmed boolean not null default false,
  venue_confirmed boolean not null default false,
  sponsor_details_confirmed boolean not null default false,
  legal_review_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entry_closes_at > entry_opens_at),
  check (happens_at > entry_closes_at),
  check (not venue_confirmed or nullif(btrim(winner_fulfillment_details), '') is not null),
  check (
    status <> 'entry_open'
    or (
      prize_funding_confirmed
      and venue_confirmed
      and sponsor_details_confirmed
      and legal_review_approved
    )
  )
);

alter table public.dating_experiment_events enable row level security;
revoke all on table public.dating_experiment_events from anon, authenticated;
grant all on table public.dating_experiment_events to service_role;

insert into public.dating_experiment_events (
  event_key, public_name, city, metro, center_zip, radius_miles, status,
  entry_cap, shortlist_max_options, winner_pair_limit, max_attempts,
  response_hours, prize_per_pair_cents, terms_version, algorithm_version,
  minimum_pair_score, winner_fulfillment_details,
  entry_opens_at, entry_closes_at, happens_at
) values (
  'boston-dating-experiment-v1',
  'The NotCupid Dating Experiment',
  'Boston',
  'boston',
  '02116',
  20,
  'draft',
  100,
  2,
  2,
  2,
  12,
  20000,
  'boston-v5-2026-08-08',
  'dating-experiment-two-pair-v3',
  55,
  'The Berkeley · 154 Berkeley Street, Back Bay, Boston — we’ll confirm the time with you.',
  '2099-12-01T05:00:00Z',
  '2099-12-31T04:59:59Z',
  '2099-12-31T23:00:00Z'
) on conflict (event_key) do nothing;

-- Preserve referential integrity if an older event key exists before this
-- migration. It is imported as cancelled and cannot accept new entries.
insert into public.dating_experiment_events (
  event_key, public_name, city, metro, center_zip, radius_miles, status,
  entry_cap, shortlist_max_options, winner_pair_limit, max_attempts,
  response_hours, prize_per_pair_cents, terms_version, algorithm_version,
  minimum_pair_score, winner_fulfillment_details,
  entry_opens_at, entry_closes_at, happens_at
)
select keys.event_key, 'Legacy Dating Experiment', 'Boston', 'boston', '02116', 20,
  'cancelled', 100, 2, 2, 2, 12, 0, 'legacy-import', 'legacy-import', 55, null,
  '2000-01-01T00:00:00Z', '2000-01-02T00:00:00Z', '2000-01-03T00:00:00Z'
from (
  select event_key from public.raffle_entries
  union select event_key from public.raffle_draws
  union select event_key from public.dating_experiment_rounds
  union select event_key from public.dating_experiment_shortlist_pairs
) keys
where keys.event_key is not null
on conflict (event_key) do nothing;

alter table public.raffle_entries
  add constraint raffle_entries_experiment_event_fkey
  foreign key (event_key) references public.dating_experiment_events(event_key);
alter table public.raffle_draws
  add constraint raffle_draws_experiment_event_fkey
  foreign key (event_key) references public.dating_experiment_events(event_key);
alter table public.dating_experiment_rounds
  add constraint dating_experiment_rounds_event_fkey
  foreign key (event_key) references public.dating_experiment_events(event_key);
alter table public.dating_experiment_shortlist_pairs
  add constraint dating_experiment_shortlist_event_fkey
  foreign key (event_key) references public.dating_experiment_events(event_key);

-- Remove first-event-only uniqueness and apply the same boundaries to every
-- event. A winner slot is unique inside its event, never globally.
drop index if exists public.raffle_draws_one_pending_per_event_idx;
drop index if exists public.raffle_draws_one_winner_per_event_idx;
drop index if exists public.raffle_draws_winner_slot_per_event_idx;
create unique index raffle_draws_one_pending_per_event_idx
  on public.raffle_draws(event_key)
  where status = 'pending';
create unique index raffle_draws_winner_slot_per_event_idx
  on public.raffle_draws(event_key, winner_slot)
  where status = 'both_accepted' and winner_slot is not null;

create or replace function public.enforce_dating_experiment_entry_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.dating_experiment_events%rowtype;
  v_active_count integer;
  v_reserving boolean;
begin
  select * into v_event
  from public.dating_experiment_events
  where event_key = new.event_key
  for update;
  if not found then
    raise exception 'dating experiment event does not exist';
  end if;

  v_reserving := tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and old.status = 'withdrawn' and new.status <> 'withdrawn')
    or (tg_op = 'UPDATE' and old.event_key is distinct from new.event_key);

  if new.status <> 'withdrawn' and exists (
    select 1 from public.users where id = new.user_id and is_test is true
  ) then
    raise exception 'test accounts cannot enter live dating experiments';
  end if;

  if v_reserving then
    if v_event.status <> 'entry_open'
      or now() < v_event.entry_opens_at
      or now() >= v_event.entry_closes_at
    then
      raise exception 'dating experiment entries are not open';
    end if;
    if new.terms_version is distinct from v_event.terms_version then
      raise exception 'dating experiment terms version is not current';
    end if;
    select count(*) into v_active_count
    from public.raffle_entries existing
    where existing.event_key = new.event_key
      and existing.status <> 'withdrawn'
      and existing.id <> new.id;
    if v_active_count >= v_event.entry_cap then
      raise exception 'dating experiment entry capacity reached';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_dating_experiment_entry_event()
  from public, anon, authenticated;
grant execute on function public.enforce_dating_experiment_entry_event()
  to service_role;
drop trigger if exists enforce_dating_experiment_entry_event on public.raffle_entries;
create trigger enforce_dating_experiment_entry_event
before insert or update of event_key, user_id, status, terms_version
on public.raffle_entries
for each row execute function public.enforce_dating_experiment_entry_event();

create or replace function public.reserve_dating_experiment_entry(
  p_event_key text,
  p_user_id uuid,
  p_video_url text,
  p_video_duration_seconds numeric,
  p_notify boolean,
  p_terms_version text,
  p_questionnaire jsonb,
  p_accepted_at timestamptz
)
returns table (was_new boolean, active_entry_count integer, spots_left integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.dating_experiment_events%rowtype;
  v_existing_status text;
  v_was_new boolean;
  v_active_count integer;
begin
  if not exists (
    select 1 from public.users where id = p_user_id and is_test is not true
  ) then
    raise exception 'participant is not eligible for a live dating experiment';
  end if;
  if p_accepted_at is null or p_video_url is null or p_questionnaire is null then
    raise exception 'dating experiment entry is incomplete';
  end if;

  select * into v_event
  from public.dating_experiment_events
  where event_key = p_event_key
  for update;
  if not found
    or v_event.status <> 'entry_open'
    or now() < v_event.entry_opens_at
    or now() >= v_event.entry_closes_at
  then
    raise exception 'dating experiment entries are not open';
  end if;
  if p_terms_version is distinct from v_event.terms_version then
    raise exception 'dating experiment terms version is not current';
  end if;

  select status into v_existing_status
  from public.raffle_entries
  where user_id = p_user_id and event_key = p_event_key
  for update;
  v_was_new := not found or v_existing_status = 'withdrawn';
  if not v_was_new and v_existing_status <> 'entered' then
    raise exception 'dating experiment entry has already been processed';
  end if;

  if v_was_new then
    select count(*) into v_active_count
    from public.raffle_entries
    where event_key = p_event_key and status <> 'withdrawn';
    if v_active_count >= v_event.entry_cap then
      raise exception 'dating experiment entry capacity reached';
    end if;
  end if;

  if v_existing_status is null then
    insert into public.raffle_entries (
      user_id, event_key, video_url, video_duration_seconds, notify, attempts,
      agreed_at, status, terms_version, terms_accepted_at, video_consent_at,
      safety_acknowledged_at, attendance_confirmed_at, publicity_consent_at,
      questionnaire, withdrawn_at
    ) values (
      p_user_id, p_event_key, p_video_url, p_video_duration_seconds,
      coalesce(p_notify, true), 0, p_accepted_at, 'entered', p_terms_version,
      p_accepted_at, p_accepted_at, p_accepted_at, p_accepted_at, null,
      p_questionnaire, null
    );
  else
    update public.raffle_entries set
      video_url = p_video_url,
      video_duration_seconds = p_video_duration_seconds,
      notify = coalesce(p_notify, true),
      attempts = case when status = 'withdrawn' then 0 else attempts end,
      agreed_at = p_accepted_at,
      status = 'entered',
      terms_version = p_terms_version,
      terms_accepted_at = p_accepted_at,
      video_consent_at = p_accepted_at,
      safety_acknowledged_at = p_accepted_at,
      attendance_confirmed_at = p_accepted_at,
      publicity_consent_at = null,
      questionnaire = p_questionnaire,
      withdrawn_at = null
    where user_id = p_user_id and event_key = p_event_key;
  end if;

  select count(*) into v_active_count
  from public.raffle_entries
  where event_key = p_event_key and status <> 'withdrawn';
  return query select v_was_new, v_active_count, greatest(0, v_event.entry_cap - v_active_count);
end;
$function$;

revoke all on function public.reserve_dating_experiment_entry(
  text, uuid, text, numeric, boolean, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.reserve_dating_experiment_entry(
  text, uuid, text, numeric, boolean, text, jsonb, timestamptz
) to service_role;

create or replace function public.enforce_dating_experiment_winner_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_winner_limit integer;
begin
  select winner_pair_limit into v_winner_limit
  from public.dating_experiment_events
  where event_key = new.event_key;
  if not found then
    raise exception 'dating experiment event does not exist';
  end if;
  if new.status = 'both_accepted' then
    if new.winner_slot is null or new.winner_slot < 1 or new.winner_slot > v_winner_limit then
      raise exception 'dating experiment winner slot exceeds this event limit';
    end if;
    if exists (
      select 1
      from public.raffle_draws existing
      where existing.event_key = new.event_key
        and existing.status = 'both_accepted'
        and existing.id <> new.id
        and (
          existing.user_a_id in (new.user_a_id, new.user_b_id)
          or existing.user_b_id in (new.user_a_id, new.user_b_id)
        )
    ) then
      raise exception 'a participant cannot win twice in one dating experiment';
    end if;
    if (
      select count(*)
      from public.raffle_draws existing
      where existing.event_key = new.event_key
        and existing.status = 'both_accepted'
        and existing.id <> new.id
    ) >= v_winner_limit then
      raise exception 'dating experiment winner capacity reached';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_dating_experiment_winner_capacity()
  from public, anon, authenticated;
grant execute on function public.enforce_dating_experiment_winner_capacity()
  to service_role;
