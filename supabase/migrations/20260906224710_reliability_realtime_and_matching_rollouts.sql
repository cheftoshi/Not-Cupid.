begin;

-- Durable transactional delivery outbox. Requests only enqueue a small,
-- idempotent instruction; provider work is leased by a worker and can be
-- retried after a serverless invocation ends. Campaign sends remain on their
-- separate approval-gated paths and may never enter this queue implicitly.
create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('push', 'love_chat_message')),
  recipient_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  entity_type text not null check (entity_type in ('love_match', 'friend_dm', 'friend_circle', 'friend_club', 'friend_plan')),
  entity_id text not null check (char_length(entity_id) between 1 and 100),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  dedupe_key text not null check (char_length(dedupe_key) between 8 and 220),
  status text not null default 'queued' check (status in ('queued', 'processing', 'delivered', 'retry', 'dead')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  available_at timestamptz not null default now(),
  leased_at timestamptz,
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dedupe_key)
);

create index if not exists notification_jobs_due_idx
  on public.notification_jobs (available_at, created_at)
  where status in ('queued', 'retry');
create index if not exists notification_jobs_recipient_idx
  on public.notification_jobs (recipient_id, created_at desc);
create index if not exists notification_jobs_health_idx
  on public.notification_jobs (status, updated_at desc);

alter table public.notification_jobs enable row level security;
revoke all on table public.notification_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.notification_jobs to service_role;

create or replace function public.claim_notification_jobs(p_limit integer default 25)
returns setof public.notification_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select j.id
    from public.notification_jobs j
    where (
      (j.status in ('queued', 'retry') and j.available_at <= now())
      or (j.status = 'processing' and j.lease_expires_at < now())
    )
    order by j.available_at, j.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.notification_jobs j
  set status = 'processing',
      attempts = j.attempts + 1,
      leased_at = now(),
      lease_expires_at = now() + interval '2 minutes',
      updated_at = now()
  from due
  where j.id = due.id
  returning j.*;
end;
$$;

create or replace function public.complete_notification_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_jobs
  set status = 'delivered', delivered_at = now(), lease_expires_at = null,
      last_error_code = null, updated_at = now()
  where id = p_job_id and status = 'processing';
  return found;
end;
$$;

create or replace function public.fail_notification_job(p_job_id uuid, p_error_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
  v_status text;
begin
  select attempts into v_attempts from public.notification_jobs where id = p_job_id for update;
  if v_attempts is null then return 'missing'; end if;
  v_status := case when v_attempts >= 6 then 'dead' else 'retry' end;
  update public.notification_jobs
  set status = v_status,
      available_at = case when v_status = 'retry'
        then now() + make_interval(secs => least(3600, (15 * power(2, greatest(0, v_attempts - 1)))::integer))
        else available_at end,
      lease_expires_at = null,
      last_error_code = left(regexp_replace(coalesce(p_error_code, 'provider_error'), '[^a-zA-Z0-9_-]', '_', 'g'), 80),
      updated_at = now()
  where id = p_job_id;
  return v_status;
end;
$$;

revoke all on function public.claim_notification_jobs(integer) from public, anon, authenticated;
revoke all on function public.complete_notification_job(uuid) from public, anon, authenticated;
revoke all on function public.fail_notification_job(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_notification_jobs(integer) to service_role;
grant execute on function public.complete_notification_job(uuid) to service_role;
grant execute on function public.fail_notification_job(uuid, text) to service_role;

-- Versioned, fail-closed live-test controls. Allocation is deterministic by
-- user id. Embedding cold-start remains shadow-only until the existing
-- evidence/readiness gate is human-approved.
create table if not exists public.matching_feature_config (
  feature_key text primary key check (feature_key in (
    'love_diversity', 'love_adaptive', 'love_embedding_cold_start', 'cross_intent_bridge'
  )),
  phase text not null default 'shadow' check (phase in ('shadow', 'live_test', 'paused')),
  allocation_percent integer not null default 0 check (allocation_percent between 0 and 100),
  kill_switch boolean not null default true,
  algorithm_version text not null,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((phase = 'live_test' and allocation_percent > 0 and kill_switch = false and approved_at is not null)
    or phase <> 'live_test')
);

alter table public.matching_feature_config enable row level security;
revoke all on table public.matching_feature_config from public, anon, authenticated;
grant select, insert, update, delete on table public.matching_feature_config to service_role;

insert into public.matching_feature_config (
  feature_key, phase, allocation_percent, kill_switch, algorithm_version, approved_at
) values
  ('love_diversity', 'live_test', 10, false, 'love-diversity-v1', now()),
  ('love_adaptive', 'live_test', 5, false, 'love-adaptive-explicit-v1', now()),
  ('love_embedding_cold_start', 'shadow', 0, true, 'love-cold-start-embedding-v1', null),
  ('cross_intent_bridge', 'live_test', 10, false, 'cross-intent-mutual-opt-in-v1', now())
on conflict (feature_key) do nothing;

alter table public.users
  add column if not exists cross_intent_bridge_opted_in_at timestamptz,
  add column if not exists cross_intent_bridge_revoked_at timestamptz;

-- Learn only from explicit accepts/passes and later reciprocal outcomes. No
-- expiry, silence, message text, or inferred sensitive attribute contributes.
create or replace function public.love_user_signal_preferences(p_user_id uuid)
returns table (reason_code text, adjustment double precision, evidence_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  with explicit_decisions as (
    select n.recipient_id as user_id,
      case when m.user_1_id = n.recipient_id then m.user_2_id else m.user_1_id end as candidate_id,
      case n.response when 'accepted' then 1.0 when 'passed' then -1.0 else 0 end as signal
    from public.love_notification_events n
    join public.matches m on m.id = n.match_id
    where n.recipient_id = p_user_id and n.response in ('accepted', 'passed')
  ),
  positive_outcomes as (
    select e.user_id, e.counterparty_user_id as candidate_id,
      case e.event_name
        when 'action_completed' then 1.0
        when 'reciprocal_response' then 1.5
        when 'reply_sent' then 2.0
        when 'two_sided_conversation' then 2.5
        when 'met' then 3.0
        when 'would_meet_again' then 4.0
        else 0 end as signal
    from public.connection_outcome_events e
    where e.user_id = p_user_id
      and e.counterparty_user_id is not null
      and e.event_name in ('action_completed', 'reciprocal_response', 'reply_sent', 'two_sided_conversation', 'met', 'would_meet_again')
  ),
  signals as (
    select * from explicit_decisions
    union all
    select * from positive_outcomes
  ),
  expanded as (
    select unnest(r.reason_codes) as reason_code, s.signal
    from signals s
    join public.roster_exposures r
      on r.user_id = s.user_id and r.candidate_id = s.candidate_id
    where cardinality(r.reason_codes) > 0
  )
  select e.reason_code,
    round(greatest(-2.0, least(2.0, sum(e.signal) / (count(*) + 3.0)))::numeric, 3)::double precision as adjustment,
    count(*)::bigint as evidence_count
  from expanded e
  group by e.reason_code
  having count(*) >= 2
  order by e.reason_code;
$$;

revoke all on function public.love_user_signal_preferences(uuid) from public, anon, authenticated;
grant execute on function public.love_user_signal_preferences(uuid) to service_role;

-- Aggregate experiment health without exposing candidate or user identities.
create or replace function public.matching_rollout_summary(p_since timestamptz)
returns table (
  algorithm_version text,
  exposures bigint,
  exposed_users bigint,
  picks bigint,
  mutual_matches bigint,
  two_sided_conversations bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with two_sided as (
    select msg.match_id
    from public.messages msg
    where msg.created_at >= p_since
    group by msg.match_id
    having count(distinct msg.sender_id) >= 2
  )
  select coalesce(r.algorithm_version, 'unknown') as algorithm_version,
    count(*)::bigint as exposures,
    count(distinct r.user_id)::bigint as exposed_users,
    count(*) filter (where r.picked_at is not null)::bigint as picks,
    count(distinct r.picked_match_id) filter (
      where m.user_1_accepted is true and m.user_2_accepted is true
    )::bigint as mutual_matches,
    count(distinct r.picked_match_id) filter (where t.match_id is not null)::bigint as two_sided_conversations
  from public.roster_exposures r
  join public.users u on u.id = r.user_id
  left join public.matches m on m.id = r.picked_match_id
  left join two_sided t on t.match_id = r.picked_match_id
  where r.shown_at >= p_since
    and u.is_test is not true
    and u.deleted_at is null
  group by coalesce(r.algorithm_version, 'unknown')
  order by exposures desc, algorithm_version;
$$;

create or replace function public.notification_outbox_health()
returns table (
  queued bigint,
  retrying bigint,
  processing bigint,
  dead bigint,
  delivered_24h bigint,
  oldest_due_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (where status = 'queued')::bigint,
    count(*) filter (where status = 'retry')::bigint,
    count(*) filter (where status = 'processing')::bigint,
    count(*) filter (where status = 'dead')::bigint,
    count(*) filter (where status = 'delivered' and delivered_at >= now() - interval '24 hours')::bigint,
    min(available_at) filter (where status in ('queued', 'retry'))
  from public.notification_jobs;
$$;

revoke all on function public.matching_rollout_summary(timestamptz) from public, anon, authenticated;
revoke all on function public.notification_outbox_health() from public, anon, authenticated;
grant execute on function public.matching_rollout_summary(timestamptz) to service_role;
grant execute on function public.notification_outbox_health() to service_role;

-- A later historical migration accidentally restored the pre-release consent
-- label in this canonical readiness function. Keep promotion evidence aligned
-- with the versioned consent contract used by the application while retaining
-- the current no-candidate shadow evaluation semantics.
create or replace function public.connection_intelligence_promotion_readiness()
returns table (
  measurement_started_at timestamptz,
  phase text,
  candidate_algorithm_version text,
  shadow_evaluations bigint,
  action_events bigint,
  consenting_users bigint,
  ready_embedding_users bigint,
  shadow_error_rate numeric,
  p95_latency_ms numeric,
  live_order_change_count bigint,
  minimum_shadow_evaluations integer,
  minimum_action_events integer,
  minimum_consenting_users integer,
  maximum_shadow_error_rate numeric,
  maximum_p95_latency_ms integer,
  live_allocation_percent integer,
  kill_switch boolean,
  human_approved_at timestamptz,
  ready_for_human_review boolean,
  live_test_enabled boolean,
  blockers text[]
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  cfg public.connection_intelligence_config%rowtype;
  evaluation_count bigint := 0;
  action_count bigint := 0;
  consent_count bigint := 0;
  ready_user_count bigint := 0;
  failed_evaluation_count bigint := 0;
  order_change_count bigint := 0;
  computed_error_rate numeric := 0;
  computed_p95 numeric := 0;
  computed_blockers text[] := array[]::text[];
  can_review boolean := false;
begin
  select * into cfg
  from public.connection_intelligence_config
  where id = 'primary';

  select
    count(*) filter (where e.error_code is distinct from 'no_shadow_candidates'),
    count(*) filter (where e.error_code is not null and e.error_code <> 'no_shadow_candidates'),
    count(*) filter (where e.live_order_changed and e.error_code is distinct from 'no_shadow_candidates'),
    coalesce((percentile_cont(0.95) within group (order by e.latency_ms)
      filter (where e.latency_ms is not null and e.error_code is distinct from 'no_shadow_candidates'))::numeric, 0)
  into evaluation_count, failed_evaluation_count, order_change_count, computed_p95
  from public.embedding_shadow_evaluations e
  join public.users u on u.id = e.user_id
  where e.created_at >= cfg.measurement_started_at
    and u.is_test is not true
    and u.deleted_at is null;

  select count(*) into action_count
  from public.connection_outcome_events e
  left join public.users u on u.id = e.user_id
  where e.occurred_at >= cfg.measurement_started_at
    and e.event_name in (
      'action_completed', 'reciprocal_response', 'first_message',
      'reply_sent', 'two_sided_conversation', 'met', 'would_meet_again'
    )
    and (e.user_id is null or (u.is_test is not true and u.deleted_at is null));

  select
    count(distinct u.id),
    count(distinct e.user_id) filter (where e.status = 'ready')
  into consent_count, ready_user_count
  from public.users u
  left join public.user_connection_embeddings e on e.user_id = u.id
  where u.ai_matching_consent_version = 'matching-embeddings-openai-v1-2026-08-20'
    and u.ai_matching_consent_at is not null
    and u.ai_matching_consent_revoked_at is null
    and u.is_test is not true
    and u.deleted_at is null
    and u.is_blocked is not true;

  computed_error_rate := case
    when evaluation_count = 0 then 0
    else failed_evaluation_count::numeric / evaluation_count
  end;

  if evaluation_count < cfg.minimum_shadow_evaluations then
    computed_blockers := array_append(computed_blockers, 'not_enough_shadow_evaluations');
  end if;
  if action_count < cfg.minimum_action_events then
    computed_blockers := array_append(computed_blockers, 'not_enough_connection_actions');
  end if;
  if consent_count < cfg.minimum_consenting_users then
    computed_blockers := array_append(computed_blockers, 'not_enough_consented_users');
  end if;
  if ready_user_count < cfg.minimum_consenting_users then
    computed_blockers := array_append(computed_blockers, 'not_enough_ready_embedding_users');
  end if;
  if computed_error_rate > cfg.maximum_shadow_error_rate then
    computed_blockers := array_append(computed_blockers, 'shadow_error_rate_too_high');
  end if;
  if computed_p95 > cfg.maximum_p95_latency_ms then
    computed_blockers := array_append(computed_blockers, 'shadow_latency_too_high');
  end if;
  if order_change_count > 0 then
    computed_blockers := array_append(computed_blockers, 'live_order_changed');
  end if;

  can_review := cardinality(computed_blockers) = 0;

  return query select
    cfg.measurement_started_at,
    cfg.phase,
    cfg.candidate_algorithm_version,
    evaluation_count,
    action_count,
    consent_count,
    ready_user_count,
    round(computed_error_rate, 5),
    round(computed_p95, 1),
    order_change_count,
    cfg.minimum_shadow_evaluations,
    cfg.minimum_action_events,
    cfg.minimum_consenting_users,
    cfg.maximum_shadow_error_rate,
    cfg.maximum_p95_latency_ms,
    cfg.live_allocation_percent,
    cfg.kill_switch,
    cfg.human_approved_at,
    can_review,
    (
      cfg.phase = 'live_test'
      and cfg.human_approved_at is not null
      and cfg.kill_switch is false
      and cfg.live_allocation_percent between 1 and 20
    ),
    computed_blockers;
end;
$$;

revoke all on function public.connection_intelligence_promotion_readiness()
  from public, anon, authenticated;
grant execute on function public.connection_intelligence_promotion_readiness()
  to service_role;

commit;
