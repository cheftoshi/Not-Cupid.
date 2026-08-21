-- Connection intelligence foundation
--
-- This migration does two things without changing any live match ordering:
--   1. creates a canonical, server-owned outcome ledger for Love, Friend and
--      Hub recommendation measurement; and
--   2. creates consent-gated pgvector storage plus a read-only shadow
--      retrieval/evaluation path.
--
-- Embeddings never contain names, email addresses, ZIP codes, photos, raw
-- messages, bios, or prompt text. Application code supplies a deterministic
-- summary of explicit quiz scores, values, rhythms and interests only.

begin;

create extension if not exists vector with schema extensions;

alter table public.users
  add column if not exists ai_matching_consent_version text,
  add column if not exists ai_matching_consent_at timestamptz,
  add column if not exists ai_matching_consent_revoked_at timestamptz,
  add column if not exists ai_matching_embedding_checked_at timestamptz;

alter table public.app_client_events
  add column if not exists algorithm_version text,
  add column if not exists treatment_id uuid,
  add column if not exists acquisition_source text;

alter table public.concierge_recommendations
  add column if not exists treatment_id uuid not null default gen_random_uuid();

alter table public.roster_exposures
  add column if not exists treatment_id uuid;

alter table public.matches
  add column if not exists treatment_id uuid;

create table if not exists public.connection_outcome_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  counterparty_user_id uuid references public.users(id) on delete set null,
  surface text not null check (char_length(surface) between 1 and 64),
  event_name text not null check (char_length(event_name) between 1 and 64),
  entity_type text check (entity_type is null or char_length(entity_type) between 1 and 40),
  entity_id uuid,
  recommendation_id uuid references public.concierge_recommendations(id) on delete set null,
  algorithm_version text,
  treatment_id uuid,
  metro text,
  acquisition_source text,
  device_class text check (device_class is null or device_class in ('phone', 'tablet', 'desktop', 'unknown')),
  display_mode text check (display_mode is null or display_mode in ('standalone', 'minimal-ui', 'fullscreen', 'browser', 'unknown')),
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_id is null or counterparty_user_id is null or user_id <> counterparty_user_id)
);

create unique index if not exists connection_outcome_events_dedupe_uidx
  on public.connection_outcome_events (dedupe_key);
create index if not exists connection_outcome_events_funnel_idx
  on public.connection_outcome_events (surface, event_name, occurred_at desc);
create index if not exists connection_outcome_events_user_idx
  on public.connection_outcome_events (user_id, occurred_at desc)
  where user_id is not null;
create index if not exists connection_outcome_events_entity_idx
  on public.connection_outcome_events (entity_type, entity_id, occurred_at desc)
  where entity_id is not null;
create index if not exists connection_outcome_events_treatment_idx
  on public.connection_outcome_events (treatment_id, occurred_at desc)
  where treatment_id is not null;

alter table public.connection_outcome_events enable row level security;
revoke all on table public.connection_outcome_events from public, anon, authenticated;
grant select, insert, update, delete on table public.connection_outcome_events to service_role;

comment on table public.connection_outcome_events is
  'Canonical, append-only connection funnel facts. Server/service-role only; no raw chat or AI prompt content.';

create table if not exists public.user_connection_embeddings (
  user_id uuid not null references public.users(id) on delete cascade,
  intent_scope text not null check (intent_scope in ('love', 'friend')),
  model text not null check (char_length(model) between 1 and 80),
  dimensions integer not null check (dimensions = 384),
  input_version text not null check (char_length(input_version) between 1 and 80),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  consent_version text not null check (char_length(consent_version) between 1 and 120),
  embedding extensions.vector(384),
  status text not null default 'ready' check (status in ('ready', 'failed')),
  error_code text,
  prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  last_attempt_at timestamptz not null default now(),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, intent_scope, model, dimensions, input_version),
  check ((status = 'ready' and embedding is not null and generated_at is not null)
    or (status = 'failed' and embedding is null))
);

create index if not exists user_connection_embeddings_ready_idx
  on public.user_connection_embeddings (intent_scope, model, input_version, updated_at desc)
  where status = 'ready';

alter table public.user_connection_embeddings enable row level security;
revoke all on table public.user_connection_embeddings from public, anon, authenticated;
grant select, insert, update, delete on table public.user_connection_embeddings to service_role;

comment on table public.user_connection_embeddings is
  'Consent-gated OpenAI embeddings over a restricted, deterministic profile summary. Never exposed to clients.';

create or replace function public.invalidate_connection_embedding_check()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.ai_matching_embedding_checked_at := null;
  return new;
end;
$$;

drop trigger if exists invalidate_connection_embedding_check_trigger on public.users;
create trigger invalidate_connection_embedding_check_trigger
  before update of
    score_honesty, score_emotionality, score_extraversion,
    score_agreeableness, score_conscientiousness, score_openness,
    values_profile, vibes, music, food, hobbies, sports, friend_vibes,
    pool_active, friend_opted_in_at, ai_matching_consent_version,
    ai_matching_consent_revoked_at
  on public.users
  for each row execute function public.invalidate_connection_embedding_check();

revoke all on function public.invalidate_connection_embedding_check() from public, anon, authenticated;

create table if not exists public.embedding_shadow_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  intent_scope text not null check (intent_scope in ('love', 'friend')),
  live_algorithm_version text not null,
  shadow_algorithm_version text not null,
  embedding_model text not null,
  embedding_dimensions integer not null check (embedding_dimensions = 384),
  eligible_candidate_count integer not null check (eligible_candidate_count >= 0),
  live_top_ids uuid[] not null default '{}',
  shadow_top_ids uuid[] not null default '{}',
  overlap_count integer not null check (overlap_count >= 0),
  overlap_rate numeric(6,5) not null check (overlap_rate between 0 and 1),
  rank_correlation numeric(7,6),
  latency_ms integer check (latency_ms is null or latency_ms between 0 and 600000),
  live_order_changed boolean not null default false check (live_order_changed = false),
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists embedding_shadow_evaluations_created_idx
  on public.embedding_shadow_evaluations (intent_scope, created_at desc);
create index if not exists embedding_shadow_evaluations_user_idx
  on public.embedding_shadow_evaluations (user_id, created_at desc);

alter table public.embedding_shadow_evaluations enable row level security;
revoke all on table public.embedding_shadow_evaluations from public, anon, authenticated;
grant select, insert, update, delete on table public.embedding_shadow_evaluations to service_role;

comment on table public.embedding_shadow_evaluations is
  'Offline comparison of current ranking versus vector retrieval. live_order_changed is constrained false.';

-- Exact cosine search is deliberate for the current pool size. It avoids an
-- approximate-index recall tradeoff until the real candidate count warrants
-- one. Candidate ids come from the existing reciprocal eligibility pipeline,
-- so vector retrieval can never widen the eligible pool.
create or replace function public.search_connection_embeddings_shadow(
  p_user_id uuid,
  p_intent_scope text,
  p_candidate_ids uuid[],
  p_match_count integer default 50
)
returns table (user_id uuid, similarity double precision)
language sql
security definer
set search_path = public, extensions
stable
as $$
  with query_embedding as (
    select e.embedding, e.model, e.dimensions, e.input_version
    from public.user_connection_embeddings e
    join public.users u on u.id = e.user_id
    where e.user_id = p_user_id
      and e.intent_scope = p_intent_scope
      and e.status = 'ready'
      and u.deleted_at is null
      and u.is_blocked is not true
      and u.ai_matching_consent_revoked_at is null
      and u.ai_matching_consent_version = e.consent_version
    order by e.generated_at desc
    limit 1
  )
  select candidate.user_id,
    (1 - (candidate.embedding <=> query.embedding))::double precision as similarity
  from query_embedding query
  join public.user_connection_embeddings candidate
    on candidate.intent_scope = p_intent_scope
   and candidate.model = query.model
   and candidate.dimensions = query.dimensions
   and candidate.input_version = query.input_version
   and candidate.status = 'ready'
   and candidate.user_id = any(coalesce(p_candidate_ids, '{}'::uuid[]))
  join public.users candidate_user on candidate_user.id = candidate.user_id
  join public.users query_user on query_user.id = p_user_id
  where candidate.user_id <> p_user_id
    and candidate_user.deleted_at is null
    and candidate_user.is_blocked is not true
    and candidate_user.ai_matching_consent_revoked_at is null
    and candidate_user.ai_matching_consent_version = candidate.consent_version
    and coalesce(candidate_user.is_test, false) = coalesce(query_user.is_test, false)
  order by candidate.embedding <=> query.embedding, candidate.user_id
  limit greatest(1, least(coalesce(p_match_count, 50), 100));
$$;

revoke all on function public.search_connection_embeddings_shadow(uuid, text, uuid[], integer)
  from public, anon, authenticated;
grant execute on function public.search_connection_embeddings_shadow(uuid, text, uuid[], integer)
  to service_role;

-- Mirror the core Love action atomically with the pick ledger insert.
create or replace function public.log_connection_love_pick_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_algorithm text;
  v_treatment uuid;
  v_source text;
begin
  select m.algorithm_version, coalesce(m.treatment_id, r.treatment_id), u.acquisition_source
    into v_algorithm, v_treatment, v_source
  from public.matches m
  left join public.roster_exposures r
    on r.user_id = new.user_id and r.candidate_id = new.candidate_id
  left join public.users u on u.id = new.user_id
  where m.id = new.match_id;

  insert into public.connection_outcome_events (
    user_id, counterparty_user_id, surface, event_name, entity_type, entity_id,
    algorithm_version, treatment_id, acquisition_source, dedupe_key, metadata
  ) values (
    new.user_id, new.candidate_id, 'love_roster', 'action_completed', 'love_match', new.match_id,
    coalesce(v_algorithm, 'unknown'), v_treatment, v_source,
    'connection:love-pick:' || new.id::text,
    jsonb_build_object('access_type', new.access_type)
  ) on conflict (dedupe_key) do nothing;
  return new;
exception when others then
  raise warning 'connection Love pick outcome skipped: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.log_connection_love_pick_outcome() from public, anon, authenticated;
drop trigger if exists connection_love_pick_outcome_trigger on public.love_pick_ledger;
create trigger connection_love_pick_outcome_trigger
  after insert on public.love_pick_ledger
  for each row execute function public.log_connection_love_pick_outcome();

-- Match state transitions produce reciprocal and terminal outcomes. The
-- trigger is idempotent, and it never needs to inspect client events.
create or replace function public.log_connection_match_state_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
  v_user uuid;
  v_other uuid;
  v_source text;
begin
  if new.user_1_accepted is true and new.user_2_accepted is true
    and not (coalesce(old.user_1_accepted, false) and coalesce(old.user_2_accepted, false)) then
    foreach v_user in array array[new.user_1_id, new.user_2_id] loop
      v_other := case when v_user = new.user_1_id then new.user_2_id else new.user_1_id end;
      select acquisition_source into v_source from public.users where id = v_user;
      insert into public.connection_outcome_events (
        user_id, counterparty_user_id, surface, event_name, entity_type, entity_id,
        algorithm_version, treatment_id, acquisition_source, dedupe_key
      ) values (
        v_user, v_other, 'love_match', 'reciprocal_response', 'love_match', new.id,
        coalesce(new.algorithm_version, 'unknown'), new.treatment_id, v_source,
        'connection:love-mutual:' || new.id::text || ':' || v_user::text
      ) on conflict (dedupe_key) do nothing;
    end loop;
  end if;

  if new.status is distinct from old.status and new.status in ('passed', 'expired') then
    v_event := new.status;
    foreach v_user in array array[new.user_1_id, new.user_2_id] loop
      v_other := case when v_user = new.user_1_id then new.user_2_id else new.user_1_id end;
      select acquisition_source into v_source from public.users where id = v_user;
      insert into public.connection_outcome_events (
        user_id, counterparty_user_id, surface, event_name, entity_type, entity_id,
        algorithm_version, treatment_id, acquisition_source, dedupe_key,
        metadata, occurred_at
      ) values (
        v_user, v_other, 'love_match', v_event, 'love_match', new.id,
        coalesce(new.algorithm_version, 'unknown'), new.treatment_id, v_source,
        'connection:love-terminal:' || new.id::text || ':' || v_event || ':' || v_user::text,
        jsonb_build_object('ended_reason', new.ended_reason), coalesce(new.ended_at, now())
      ) on conflict (dedupe_key) do nothing;
    end loop;
  end if;
  return new;
exception when others then
  raise warning 'connection match-state outcome skipped: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.log_connection_match_state_outcome() from public, anon, authenticated;
drop trigger if exists connection_match_state_outcome_trigger on public.matches;
create trigger connection_match_state_outcome_trigger
  after update on public.matches
  for each row execute function public.log_connection_match_state_outcome();

-- Capture first message, the first reply, and the first two-sided exchange.
-- Message bodies never enter the ledger.
create or replace function public.log_connection_love_message_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other uuid;
  v_sender_had_message boolean;
  v_other_had_message boolean;
  v_algorithm text;
  v_treatment uuid;
  v_source text;
  v_other_source text;
begin
  select
    case when m.user_1_id = new.sender_id then m.user_2_id else m.user_1_id end,
    m.algorithm_version,
    m.treatment_id
  into v_other, v_algorithm, v_treatment
  from public.matches m
  where m.id = new.match_id and new.sender_id in (m.user_1_id, m.user_2_id);
  if v_other is null then return new; end if;

  select exists (
    select 1 from public.messages prior
    where prior.match_id = new.match_id and prior.sender_id = new.sender_id
      and (prior.created_at, prior.id::text) < (new.created_at, new.id::text)
  ), exists (
    select 1 from public.messages prior
    where prior.match_id = new.match_id and prior.sender_id = v_other
      and (prior.created_at, prior.id::text) < (new.created_at, new.id::text)
  ) into v_sender_had_message, v_other_had_message;

  select acquisition_source into v_source from public.users where id = new.sender_id;
  select acquisition_source into v_other_source from public.users where id = v_other;

  if not v_sender_had_message and not v_other_had_message then
    insert into public.connection_outcome_events (
      user_id, counterparty_user_id, surface, event_name, entity_type, entity_id,
      algorithm_version, treatment_id, acquisition_source, dedupe_key
    ) values (
      new.sender_id, v_other, 'love_chat', 'first_message', 'love_match', new.match_id,
      coalesce(v_algorithm, 'unknown'), v_treatment, v_source,
      'connection:love-first-message:' || new.match_id::text
    ) on conflict (dedupe_key) do nothing;
  elsif not v_sender_had_message and v_other_had_message then
    insert into public.connection_outcome_events (
      user_id, counterparty_user_id, surface, event_name, entity_type, entity_id,
      algorithm_version, treatment_id, acquisition_source, dedupe_key
    ) values (
      new.sender_id, v_other, 'love_chat', 'reply_sent', 'love_match', new.match_id,
      coalesce(v_algorithm, 'unknown'), v_treatment, v_source,
      'connection:love-reply-sent:' || new.match_id::text || ':' || new.sender_id::text
    ) on conflict (dedupe_key) do nothing;

    insert into public.connection_outcome_events (
      user_id, counterparty_user_id, surface, event_name, entity_type, entity_id,
      algorithm_version, treatment_id, acquisition_source, dedupe_key
    ) values (
      v_other, new.sender_id, 'love_chat', 'reply_received', 'love_match', new.match_id,
      coalesce(v_algorithm, 'unknown'), v_treatment, v_other_source,
      'connection:love-reply-received:' || new.match_id::text || ':' || v_other::text
    ) on conflict (dedupe_key) do nothing;

    insert into public.connection_outcome_events (
      user_id, counterparty_user_id, surface, event_name, entity_type, entity_id,
      algorithm_version, treatment_id, acquisition_source, dedupe_key
    ) values
      (new.sender_id, v_other, 'love_chat', 'two_sided_conversation', 'love_match', new.match_id,
       coalesce(v_algorithm, 'unknown'), v_treatment, v_source,
       'connection:love-two-sided:' || new.match_id::text || ':' || new.sender_id::text),
      (v_other, new.sender_id, 'love_chat', 'two_sided_conversation', 'love_match', new.match_id,
       coalesce(v_algorithm, 'unknown'), v_treatment, v_other_source,
       'connection:love-two-sided:' || new.match_id::text || ':' || v_other::text)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'connection Love message outcome skipped: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.log_connection_love_message_outcome() from public, anon, authenticated;
drop trigger if exists connection_love_message_outcome_trigger on public.messages;
create trigger connection_love_message_outcome_trigger
  after insert on public.messages
  for each row execute function public.log_connection_love_message_outcome();

-- A submitted post-date check-in is the strongest available real-world
-- outcome. Notes stay in their source table and are never copied here.
create or replace function public.log_connection_date_feedback_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other uuid;
  v_algorithm text;
  v_treatment uuid;
  v_source text;
begin
  select case when m.user_1_id = new.user_id then m.user_2_id else m.user_1_id end,
    m.algorithm_version, m.treatment_id
  into v_other, v_algorithm, v_treatment
  from public.matches m
  where m.id = new.match_id and new.user_id in (m.user_1_id, m.user_2_id);
  if v_other is null then return new; end if;
  select acquisition_source into v_source from public.users where id = new.user_id;

  insert into public.connection_outcome_events (
    user_id, counterparty_user_id, surface, event_name, entity_type, entity_id,
    algorithm_version, treatment_id, acquisition_source, dedupe_key, metadata,
    occurred_at
  ) values (
    new.user_id, v_other, 'love_date', 'met', 'love_match', new.match_id,
    coalesce(v_algorithm, 'unknown'), v_treatment, v_source,
    'connection:date-feedback:met:' || new.id::text,
    jsonb_build_object('rating', new.rating), new.created_at
  ) on conflict (dedupe_key) do nothing;

  if new.would_again is not null then
    insert into public.connection_outcome_events (
      user_id, counterparty_user_id, surface, event_name, entity_type, entity_id,
      algorithm_version, treatment_id, acquisition_source, dedupe_key, metadata,
      occurred_at
    ) values (
      new.user_id, v_other, 'love_date', 'would_meet_again', 'love_match', new.match_id,
      coalesce(v_algorithm, 'unknown'), v_treatment, v_source,
      'connection:date-feedback:would-again:' || new.id::text,
      jsonb_build_object('value', new.would_again), new.created_at
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'connection date-feedback outcome skipped: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.log_connection_date_feedback_outcome() from public, anon, authenticated;
drop trigger if exists connection_date_feedback_outcome_trigger on public.date_feedback;
create trigger connection_date_feedback_outcome_trigger
  after insert on public.date_feedback
  for each row execute function public.log_connection_date_feedback_outcome();

create or replace function public.log_connection_safety_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid;
  v_target uuid;
  v_match uuid;
  v_reason text;
  v_source text;
  v_algorithm text;
  v_treatment uuid;
begin
  if tg_table_name = 'user_reports' then
    v_reporter := new.reporter_id;
    v_target := new.reported_id;
    v_match := new.match_id;
    v_reason := new.reason;
  else
    v_reporter := new.reporter_id;
    v_target := new.target_id;
    v_match := new.match_id;
    v_reason := new.reason;
  end if;
  select acquisition_source into v_source from public.users where id = v_reporter;
  if v_match is not null then
    select algorithm_version, treatment_id into v_algorithm, v_treatment
      from public.matches where id = v_match;
  end if;
  insert into public.connection_outcome_events (
    user_id, counterparty_user_id, surface, event_name, entity_type, entity_id,
    algorithm_version, treatment_id, acquisition_source, dedupe_key, metadata,
    occurred_at
  ) values (
    v_reporter, v_target, 'safety', 'reported',
    case when v_match is null then 'user' else 'love_match' end,
    coalesce(v_match, v_target), coalesce(v_algorithm, 'unknown'), v_treatment,
    v_source, 'connection:safety:' || tg_table_name || ':' || new.id::text,
    jsonb_build_object('reason_code', left(coalesce(v_reason, 'unspecified'), 40)), new.created_at
  ) on conflict (dedupe_key) do nothing;
  return new;
exception when others then
  raise warning 'connection safety outcome skipped: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.log_connection_safety_outcome() from public, anon, authenticated;
drop trigger if exists connection_user_report_outcome_trigger on public.user_reports;
create trigger connection_user_report_outcome_trigger
  after insert on public.user_reports
  for each row execute function public.log_connection_safety_outcome();
drop trigger if exists connection_end_report_outcome_trigger on public.end_reports;
create trigger connection_end_report_outcome_trigger
  after insert on public.end_reports
  for each row execute function public.log_connection_safety_outcome();

-- Friend actions are already server-written. Mirror them into the shared
-- outcome vocabulary so Love/Friend/Hub can be compared without losing their
-- surface-specific source tables.
create or replace function public.log_connection_friend_action_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
  v_outcome text;
begin
  select acquisition_source into v_source from public.users where id = new.user_id;
  v_outcome := case when new.event = 'discovery_viewed' then 'recommendation_opened' else 'action_completed' end;
  insert into public.connection_outcome_events (
    user_id, surface, event_name, entity_type, entity_id, acquisition_source,
    dedupe_key, metadata, occurred_at
  ) values (
    new.user_id, 'friend', v_outcome, coalesce(new.subject_type, 'friend_action'),
    case when new.subject_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then new.subject_id::uuid else null end,
    v_source, 'connection:friend-action:' || new.id::text,
    new.metadata || jsonb_build_object('source_event', new.event), new.created_at
  ) on conflict (dedupe_key) do nothing;
  return new;
exception when others then
  raise warning 'connection Friend outcome skipped: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.log_connection_friend_action_outcome() from public, anon, authenticated;
drop trigger if exists connection_friend_action_outcome_trigger on public.friend_action_events;
create trigger connection_friend_action_outcome_trigger
  after insert on public.friend_action_events
  for each row execute function public.log_connection_friend_action_outcome();

-- Concierge recommendation decisions are captured at the durable state
-- change, not from an optional browser beacon.
create or replace function public.log_connection_concierge_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
  v_event text;
begin
  select acquisition_source into v_source from public.users where id = new.user_id;
  if tg_op = 'INSERT' then
    v_event := 'recommendation_shown';
  elsif new.outcome_state is distinct from old.outcome_state
    and new.outcome_state in ('acted', 'dismissed', 'completed', 'reciprocal', 'expired') then
    v_event := case new.outcome_state
      when 'acted' then 'recommendation_opened'
      when 'dismissed' then 'recommendation_dismissed'
      when 'completed' then 'action_completed'
      when 'reciprocal' then 'reciprocal_response'
      else 'expired'
    end;
  else
    return new;
  end if;

  insert into public.connection_outcome_events (
    user_id, surface, event_name, entity_type, recommendation_id,
    algorithm_version, treatment_id, acquisition_source, dedupe_key, metadata,
    occurred_at
  ) values (
    new.user_id, 'hub_concierge', v_event, new.target_type, new.id,
    new.ranker_version, new.treatment_id, v_source,
    'connection:concierge:' || new.id::text || ':' || v_event,
    jsonb_build_object('action_type', new.action_type, 'source', new.source,
      'confidence', new.confidence_band),
    case when v_event = 'recommendation_shown' then new.shown_at else coalesce(new.outcome_at, new.acted_at, new.dismissed_at, now()) end
  ) on conflict (dedupe_key) do nothing;
  return new;
exception when others then
  raise warning 'connection concierge outcome skipped: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.log_connection_concierge_outcome() from public, anon, authenticated;
drop trigger if exists connection_concierge_outcome_insert_trigger on public.concierge_recommendations;
create trigger connection_concierge_outcome_insert_trigger
  after insert on public.concierge_recommendations
  for each row execute function public.log_connection_concierge_outcome();
drop trigger if exists connection_concierge_outcome_update_trigger on public.concierge_recommendations;
create trigger connection_concierge_outcome_update_trigger
  after update of outcome_state on public.concierge_recommendations
  for each row execute function public.log_connection_concierge_outcome();

-- Admin-only aggregates: cohort denominators exclude test/deleted users and
-- immature day windows return NULL rather than a misleading zero.
create or replace function public.connection_retention_cohorts(p_days integer default 90)
returns table (
  signup_date date,
  total_signups bigint,
  day7_pct numeric,
  day14_pct numeric,
  day30_pct numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with cohorts as (
    select u.id, u.created_at, u.created_at::date as signup_date
    from public.users u
    where u.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
      and u.deleted_at is null and u.is_test is not true
  ), retained as (
    select c.id, c.created_at, c.signup_date,
      bool_or(e.occurred_at >= c.created_at + interval '7 days'
        and e.occurred_at < c.created_at + interval '8 days') as d7,
      bool_or(e.occurred_at >= c.created_at + interval '14 days'
        and e.occurred_at < c.created_at + interval '15 days') as d14,
      bool_or(e.occurred_at >= c.created_at + interval '30 days'
        and e.occurred_at < c.created_at + interval '31 days') as d30
    from cohorts c
    left join public.connection_outcome_events e on e.user_id = c.id
    group by c.id, c.created_at, c.signup_date
  )
  select r.signup_date,
    count(*)::bigint,
    case when now() >= r.signup_date + 8 then round(100.0 * count(*) filter (where r.d7) / nullif(count(*), 0), 2) end,
    case when now() >= r.signup_date + 15 then round(100.0 * count(*) filter (where r.d14) / nullif(count(*), 0), 2) end,
    case when now() >= r.signup_date + 31 then round(100.0 * count(*) filter (where r.d30) / nullif(count(*), 0), 2) end
  from retained r
  group by r.signup_date
  order by r.signup_date desc;
$$;

revoke all on function public.connection_retention_cohorts(integer) from public, anon, authenticated;
grant execute on function public.connection_retention_cohorts(integer) to service_role;

create or replace function public.connection_outcome_summary(p_since timestamptz)
returns table (
  surface text,
  event_name text,
  total bigint,
  unique_users bigint,
  unique_entities bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select e.surface, e.event_name, count(*)::bigint,
    count(distinct e.user_id)::bigint, count(distinct e.entity_id)::bigint
  from public.connection_outcome_events e
  left join public.users u on u.id = e.user_id
  where e.occurred_at >= p_since
    and (e.user_id is null or (u.is_test is not true and u.deleted_at is null))
  group by e.surface, e.event_name
  order by e.surface, e.event_name;
$$;

revoke all on function public.connection_outcome_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.connection_outcome_summary(timestamptz) to service_role;

create or replace function public.embedding_shadow_summary(p_since timestamptz)
returns table (
  intent_scope text,
  evaluations bigint,
  users bigint,
  avg_overlap_rate numeric,
  avg_rank_correlation numeric,
  p75_latency_ms numeric,
  error_rate numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select e.intent_scope,
    count(*)::bigint,
    count(distinct e.user_id)::bigint,
    round(avg(e.overlap_rate), 4),
    round(avg(e.rank_correlation), 4),
    round((percentile_cont(0.75) within group (order by e.latency_ms)
      filter (where e.latency_ms is not null))::numeric, 1),
    round(count(*) filter (where e.error_code is not null)::numeric / nullif(count(*), 0), 4)
  from public.embedding_shadow_evaluations e
  join public.users u on u.id = e.user_id
  where e.created_at >= p_since and u.is_test is not true and u.deleted_at is null
  group by e.intent_scope
  order by e.intent_scope;
$$;

revoke all on function public.embedding_shadow_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.embedding_shadow_summary(timestamptz) to service_role;

commit;
