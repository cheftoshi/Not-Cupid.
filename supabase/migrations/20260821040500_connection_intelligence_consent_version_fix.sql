-- Keep evidence-gate consent counters aligned with the versioned consent
-- contract used by the application. The original gate migration referenced a
-- pre-release label, which caused valid consent and ready vectors to be
-- excluded from promotion-readiness counts.

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
      where u.ai_matching_consent_version = 'matching-embeddings-openai-v1-2026-08-20'
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

revoke all on function public.connection_intelligence_promotion_readiness() from public, anon, authenticated;
grant execute on function public.connection_intelligence_promotion_readiness() to service_role;
