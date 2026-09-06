begin;

-- Every terminal Love connection must leave one canonical pair tombstone.
-- Several older expiry paths updated `matches` without writing match_history;
-- that allowed a previous partner back into the roster and the later pick hit
-- love_pick_ledger's pair uniqueness constraint.
create or replace function public.capture_terminal_love_match_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_finished_at timestamptz;
begin
  if new.user_1_id is null or new.user_2_id is null or new.user_1_id = new.user_2_id then
    return new;
  end if;
  if new.ended_at is null and new.status not in ('ended', 'passed', 'expired') then
    return new;
  end if;

  v_user_a := least(new.user_1_id, new.user_2_id);
  v_user_b := greatest(new.user_1_id, new.user_2_id);
  v_finished_at := coalesce(new.ended_at, new.created_at, clock_timestamp());

  insert into public.match_history as history (
    user_a_id, user_b_id, match_id, last_matched_at, outcome
  ) values (
    v_user_a, v_user_b, new.id, v_finished_at,
    coalesce(new.ended_reason, new.status, 'ended')
  )
  on conflict (user_a_id, user_b_id) do update
    set match_id = excluded.match_id,
        last_matched_at = excluded.last_matched_at,
        outcome = excluded.outcome
    where excluded.last_matched_at >= coalesce(history.last_matched_at, '-infinity'::timestamptz);

  return new;
end;
$$;

revoke all on function public.capture_terminal_love_match_history()
  from public, anon, authenticated;
grant execute on function public.capture_terminal_love_match_history()
  to service_role;

drop trigger if exists capture_terminal_love_match_history_trigger on public.matches;
create trigger capture_terminal_love_match_history_trigger
  after insert or update on public.matches
  for each row execute function public.capture_terminal_love_match_history();

-- Repair every historical terminal row, keeping the newest outcome for a pair.
with newest_terminal as (
  select distinct on (
    least(m.user_1_id, m.user_2_id),
    greatest(m.user_1_id, m.user_2_id)
  )
    least(m.user_1_id, m.user_2_id) as user_a_id,
    greatest(m.user_1_id, m.user_2_id) as user_b_id,
    m.id as match_id,
    coalesce(m.ended_at, m.created_at, now()) as last_matched_at,
    coalesce(m.ended_reason, m.status, 'ended') as outcome
  from public.matches m
  where m.user_1_id is not null
    and m.user_2_id is not null
    and m.user_1_id <> m.user_2_id
    and (m.ended_at is not null or m.status in ('ended', 'passed', 'expired'))
  order by
    least(m.user_1_id, m.user_2_id),
    greatest(m.user_1_id, m.user_2_id),
    coalesce(m.ended_at, m.created_at) desc nulls last
)
insert into public.match_history as history (
  user_a_id, user_b_id, match_id, last_matched_at, outcome
)
select user_a_id, user_b_id, match_id, last_matched_at, outcome
from newest_terminal
on conflict (user_a_id, user_b_id) do update
  set match_id = excluded.match_id,
      last_matched_at = excluded.last_matched_at,
      outcome = excluded.outcome
  where excluded.last_matched_at >= coalesce(history.last_matched_at, '-infinity'::timestamptz);

create index if not exists matches_user_2_created_idx
  on public.matches (user_2_id, created_at desc);

-- An empty shadow result means there was no consented candidate embedding to
-- compare, not that retrieval failed. Exclude legacy no-candidate rows from
-- both the evaluation denominator and error-rate health signal.
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
    and e.error_code is distinct from 'no_shadow_candidates'
    and u.is_test is not true
    and u.deleted_at is null
  group by e.intent_scope, coalesce(e.metro, 'unknown')
  order by e.intent_scope, coalesce(e.metro, 'unknown');
$$;

revoke all on function public.embedding_shadow_summary(timestamptz)
  from public, anon, authenticated;
grant execute on function public.embedding_shadow_summary(timestamptz)
  to service_role;

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
  select * into cfg from public.connection_intelligence_config where id = 'primary';

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

revoke all on function public.connection_intelligence_promotion_readiness()
  from public, anon, authenticated;
grant execute on function public.connection_intelligence_promotion_readiness()
  to service_role;

commit;
