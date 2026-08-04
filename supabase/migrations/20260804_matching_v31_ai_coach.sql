-- Love matching V3.1 observability + bounded AI coach cache.

alter table public.matches
  add column if not exists algorithm_version text not null default 'legacy',
  add column if not exists match_score_details jsonb not null default '{}'::jsonb;

create index if not exists matches_algorithm_created_idx
  on public.matches (algorithm_version, created_at desc);
create index if not exists matches_user_1_created_idx
  on public.matches (user_1_id, created_at desc);
create index if not exists matches_user_2_created_idx
  on public.matches (user_2_id, created_at desc);

alter table public.roster_exposures
  add column if not exists position smallint,
  add column if not exists score integer,
  add column if not exists algorithm_version text,
  add column if not exists reason_codes text[] not null default '{}'::text[],
  add column if not exists reciprocal_adjustment numeric(4,1) not null default 0,
  add column if not exists picked_at timestamptz,
  add column if not exists picked_match_id uuid references public.matches(id) on delete set null;

create index if not exists roster_exposures_algorithm_shown_idx
  on public.roster_exposures (algorithm_version, shown_at desc);
create index if not exists roster_exposures_picked_idx
  on public.roster_exposures (picked_at desc) where picked_at is not null;

create table if not exists public.love_ai_coach_cache (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  stage text not null check (stage in ('opener', 'wait', 'reply', 'deepen', 'plan')),
  response jsonb not null,
  source text not null check (source in ('ai', 'curated')),
  generated_at timestamptz not null default now(),
  primary key (match_id, user_id, stage)
);

create index if not exists love_ai_coach_generated_idx
  on public.love_ai_coach_cache (generated_at desc);

alter table public.love_ai_coach_cache enable row level security;
revoke all on table public.love_ai_coach_cache from public, anon, authenticated;
grant all on table public.love_ai_coach_cache to service_role;

-- Hot-path aggregate for evidence-shrunk reciprocal reranking. The input cap
-- prevents accidental broad scans; callers outside service_role cannot execute.
create or replace function public.candidate_reciprocity_stats(
  p_candidate_ids uuid[],
  p_since timestamptz
)
returns table (
  candidate_id uuid,
  invitations bigint,
  accepted_invitations bigint,
  mutual_matches bigint,
  replied_matches bigint
)
language sql
security invoker
set search_path = ''
as $function$
  with candidates as (
    select distinct candidate_id
    from unnest(p_candidate_ids) as ids(candidate_id)
    where p_since is not null
      and cardinality(p_candidate_ids) between 1 and 500
  ), expanded as (
    select
      c.candidate_id,
      m.id as match_id,
      case when m.user_1_id = c.candidate_id then coalesce(m.user_1_accepted, false)
           else coalesce(m.user_2_accepted, false) end as candidate_accepted,
      case when m.user_1_id = c.candidate_id then coalesce(m.user_2_accepted, false)
           else coalesce(m.user_1_accepted, false) end as other_accepted
    from candidates c
    join public.matches m
      on (m.user_1_id = c.candidate_id or m.user_2_id = c.candidate_id)
     and m.created_at >= p_since
  ), base as (
    select
      e.candidate_id,
      count(*) filter (where e.other_accepted) as invitations,
      count(*) filter (where e.other_accepted and e.candidate_accepted) as accepted_invitations,
      count(*) filter (where e.other_accepted and e.candidate_accepted) as mutual_matches
    from expanded e
    group by e.candidate_id
  ), replies as (
    select e.candidate_id, count(distinct e.match_id) as replied_matches
    from expanded e
    join public.messages msg
      on msg.match_id = e.match_id
     and msg.sender_id = e.candidate_id
    where e.other_accepted and e.candidate_accepted
    group by e.candidate_id
  )
  select
    c.candidate_id,
    coalesce(b.invitations, 0)::bigint,
    coalesce(b.accepted_invitations, 0)::bigint,
    coalesce(b.mutual_matches, 0)::bigint,
    coalesce(r.replied_matches, 0)::bigint
  from candidates c
  left join base b using (candidate_id)
  left join replies r using (candidate_id);
$function$;

revoke all on function public.candidate_reciprocity_stats(uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.candidate_reciprocity_stats(uuid[], timestamptz) to service_role;
