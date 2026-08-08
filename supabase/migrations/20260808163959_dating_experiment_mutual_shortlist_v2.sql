-- Dating Experiment V2: sealed, reciprocal shortlists. These tables remain
-- service-role-only because they contain private dating decisions and offers.

create table if not exists public.dating_experiment_rounds (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  round_number integer not null check (round_number > 0),
  status text not null default 'collecting'
    check (status in ('collecting', 'resolving', 'resolved', 'no_mutual', 'cancelled')),
  response_deadline timestamptz not null,
  algorithm_version text not null,
  eligible_user_count integer not null default 0 check (eligible_user_count >= 0),
  offered_pair_count integer not null default 0 check (offered_pair_count >= 0),
  mutual_pair_count integer not null default 0 check (mutual_pair_count >= 0),
  selected_pair_id uuid,
  selection_random_value numeric(12, 10),
  selection_weight_total numeric(12, 4),
  created_at timestamptz not null default now(),
  resolution_started_at timestamptz,
  resolved_at timestamptz,
  unique (event_key, round_number)
);

create table if not exists public.dating_experiment_shortlist_pairs (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.dating_experiment_rounds(id) on delete cascade,
  event_key text not null,
  user_a_id uuid not null references public.users(id) on delete cascade,
  user_b_id uuid not null references public.users(id) on delete cascade,
  compatibility_score integer not null check (compatibility_score between 0 and 100),
  a_accepted boolean,
  b_accepted boolean,
  a_favorite boolean not null default false,
  b_favorite boolean not null default false,
  a_responded_at timestamptz,
  b_responded_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'mutual', 'declined', 'expired', 'selected', 'not_selected')),
  created_at timestamptz not null default now(),
  check (user_a_id <> user_b_id),
  check (not a_favorite or a_accepted is true),
  check (not b_favorite or b_accepted is true),
  unique (round_id, user_a_id, user_b_id)
);

alter table public.dating_experiment_rounds
  add constraint dating_experiment_rounds_selected_pair_fkey
  foreign key (selected_pair_id)
  references public.dating_experiment_shortlist_pairs(id)
  on delete set null;

create unique index if not exists dating_experiment_one_collecting_round_idx
  on public.dating_experiment_rounds(event_key)
  where status in ('collecting', 'resolving');
create index if not exists dating_experiment_rounds_event_idx
  on public.dating_experiment_rounds(event_key, round_number desc);
create index if not exists dating_experiment_shortlist_a_idx
  on public.dating_experiment_shortlist_pairs(event_key, user_a_id, status);
create index if not exists dating_experiment_shortlist_b_idx
  on public.dating_experiment_shortlist_pairs(event_key, user_b_id, status);

alter table public.dating_experiment_rounds enable row level security;
alter table public.dating_experiment_shortlist_pairs enable row level security;
revoke all on table public.dating_experiment_rounds from anon, authenticated;
revoke all on table public.dating_experiment_shortlist_pairs from anon, authenticated;
grant all on table public.dating_experiment_rounds to service_role;
grant all on table public.dating_experiment_shortlist_pairs to service_role;

create or replace function public.enforce_live_dating_experiment_pair()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.dating_experiment_rounds
    where id = new.round_id
      and event_key = new.event_key
  ) then
    raise exception 'shortlist pair event must match its round';
  end if;
  if exists (
    select 1
    from public.users
    where id in (new.user_a_id, new.user_b_id)
      and is_test is true
  ) then
    raise exception 'test accounts cannot enter live dating experiment shortlists';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_live_dating_experiment_pair() from public, anon, authenticated;
grant execute on function public.enforce_live_dating_experiment_pair() to service_role;
drop trigger if exists enforce_live_dating_experiment_pair on public.dating_experiment_shortlist_pairs;
create trigger enforce_live_dating_experiment_pair
before insert or update of user_a_id, user_b_id
on public.dating_experiment_shortlist_pairs
for each row execute function public.enforce_live_dating_experiment_pair();
