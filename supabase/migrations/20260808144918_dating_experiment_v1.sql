-- Dating Experiment v1: keep entry/selection auditable without exposing the
-- sensitive entry data through the public Supabase API.

alter table public.raffle_entries
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists video_consent_at timestamptz,
  add column if not exists safety_acknowledged_at timestamptz,
  add column if not exists attendance_confirmed_at timestamptz,
  add column if not exists publicity_consent_at timestamptz,
  add column if not exists questionnaire jsonb not null default '{}'::jsonb,
  add column if not exists video_duration_seconds numeric(5,2),
  add column if not exists withdrawn_at timestamptz;

alter table public.raffle_entries
  drop constraint if exists raffle_entries_status_check;
alter table public.raffle_entries
  add constraint raffle_entries_status_check
  check (status in ('entered', 'picked', 'passed', 'withdrawn'));

alter table public.raffle_draws
  add column if not exists algorithm_version text,
  add column if not exists eligible_pair_count integer,
  add column if not exists selection_weight numeric(10,4);

alter table public.raffle_entries enable row level security;
alter table public.raffle_draws enable row level security;
revoke all on table public.raffle_entries from anon, authenticated;
revoke all on table public.raffle_draws from anon, authenticated;
grant all on table public.raffle_entries to service_role;
grant all on table public.raffle_draws to service_role;

create index if not exists raffle_entries_terms_version_idx
  on public.raffle_entries(event_key, terms_version);

create unique index if not exists raffle_draws_one_pending_per_event_idx
  on public.raffle_draws(event_key)
  where status = 'pending'
    and event_key = 'boston-dating-experiment-v1';
create unique index if not exists raffle_draws_one_winner_per_event_idx
  on public.raffle_draws(event_key)
  where status = 'both_accepted'
    and event_key = 'boston-dating-experiment-v1';
