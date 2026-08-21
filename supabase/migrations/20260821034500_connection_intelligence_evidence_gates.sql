begin;

-- Keep shadow comparisons useful for metro and acquisition reviews without
-- adding any private location or profile data to the score card.
alter table public.embedding_shadow_evaluations
  add column if not exists metro text,
  add column if not exists acquisition_source text;

create index if not exists embedding_shadow_evaluations_segment_idx
  on public.embedding_shadow_evaluations (intent_scope, metro, created_at desc);

-- One service-only control row describes the candidate experiment. Nothing in
-- the live roster reads this table: allocation remains zero until a separately
-- reviewed live treatment is implemented.
create table if not exists public.connection_intelligence_config (
  id text primary key default 'primary' check (id = 'primary'),
  phase text not null default 'shadow'
    check (phase in ('shadow', 'review', 'paused', 'live_test')),
  candidate_algorithm_version text not null default 'connection-hybrid-v1',
  measurement_started_at timestamptz not null default now(),
  minimum_shadow_evaluations integer not null default 100
    check (minimum_shadow_evaluations between 25 and 100000),
  minimum_action_events integer not null default 30
    check (minimum_action_events between 10 and 100000),
  minimum_consenting_users integer not null default 10
    check (minimum_consenting_users between 1 and 100000),
  maximum_shadow_error_rate numeric(6,5) not null default 0.01000
    check (maximum_shadow_error_rate between 0 and 1),
  maximum_p95_latency_ms integer not null default 500
    check (maximum_p95_latency_ms between 50 and 10000),
  live_allocation_percent integer not null default 0
    check (live_allocation_percent between 0 and 20),
  kill_switch boolean not null default true,
  human_approved_at timestamptz,
  human_approved_by text,
  updated_at timestamptz not null default now(),
  check (
    phase <> 'live_test'
    or (
      human_approved_at is not null
      and kill_switch is false
      and live_allocation_percent between 1 and 20
    )
  )
);

alter table public.connection_intelligence_config enable row level security;
revoke all on table public.connection_intelligence_config from public, anon, authenticated;
grant select, insert, update on table public.connection_intelligence_config to service_role;

insert into public.connection_intelligence_config (
  id,
  phase,
  candidate_algorithm_version,
  measurement_started_at,
  live_allocation_percent,
  kill_switch
)
values (
  'primary',
  'shadow',
  'connection-hybrid-v1',
  coalesce((select min(created_at) from public.connection_outcome_events), now()),
  0,
  true
)
on conflict (id) do nothing;

-- Historical cohorts pre-date the canonical ledger and must not be displayed
-- as zero retention. Only cohorts born after measurement began are eligible.
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
  with measurement as (
    select coalesce(
      (select c.measurement_started_at
       from public.connection_intelligence_config c
       where c.id = 'primary'),
      now()
    ) as started_at
  ), cohorts as (
    select u.id, u.created_at, u.created_at::date as signup_date
    from public.users u
    cross join measurement m
    where u.created_at >= greatest(
        now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365))),
        m.started_at
      )
      and u.deleted_at is null
      and u.is_test is not true
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

drop function if exists public.embedding_shadow_summary(timestamptz);
create function public.embedding_shadow_summary(p_since timestamptz)
returns table (
  intent_scope text,
  metro text,
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
    coalesce(e.metro, 'unknown') as metro,
    count(*)::bigint,
    count(distinct e.user_id)::bigint,
    round(avg(e.overlap_rate), 4),
    round(avg(e.rank_correlation), 4),
    round((percentile_cont(0.75) within group (order by e.latency_ms)
      filter (where e.latency_ms is not null))::numeric, 1),
    round(count(*) filter (where e.error_code is not null)::numeric / nullif(count(*), 0), 4)
  from public.embedding_shadow_evaluations e
  join public.users u on u.id = e.user_id
  where e.created_at >= p_since
    and u.is_test is not true
    and u.deleted_at is null
  group by e.intent_scope, coalesce(e.metro, 'unknown')
  order by e.intent_scope, coalesce(e.metro, 'unknown');
$$;

revoke all on function public.embedding_shadow_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.embedding_shadow_summary(timestamptz) to service_role;

create or replace function public.connection_embedding_coverage()
returns table (
  consenting_real_users bigint,
  ready_real_users bigint,
  ready_intent_embeddings bigint,
  failed_intent_embeddings bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(distinct u.id) filter (
      where u.ai_matching_consent_version = 'ai-matching-embedding-v1'
        and u.ai_matching_consent_at is not null
        and u.ai_matching_consent_revoked_at is null
    )::bigint,
    count(distinct e.user_id) filter (where e.status = 'ready')::bigint,
    count(e.user_id) filter (where e.status = 'ready')::bigint,
    count(e.user_id) filter (where e.status = 'failed')::bigint
  from public.users u
  left join public.user_connection_embeddings e on e.user_id = u.id
  where u.is_test is not true
    and u.deleted_at is null
    and u.is_blocked is not true;
$$;

revoke all on function public.connection_embedding_coverage() from public, anon, authenticated;
grant execute on function public.connection_embedding_coverage() to service_role;

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
    count(*),
    count(*) filter (where e.error_code is not null),
    count(*) filter (where e.live_order_changed),
    coalesce((percentile_cont(0.95) within group (order by e.latency_ms)
      filter (where e.latency_ms is not null))::numeric, 0)
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
  where u.ai_matching_consent_version = 'ai-matching-embedding-v1'
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

revoke all on function public.connection_intelligence_promotion_readiness() from public, anon, authenticated;
grant execute on function public.connection_intelligence_promotion_readiness() to service_role;

commit;
