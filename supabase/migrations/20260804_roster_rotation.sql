-- Love Line roster exposure history. The live roster uses this to avoid showing
-- the same candidate again during the seven-day rotation cooldown when another
-- eligible option exists. One row per ordered pair is enough because only the
-- latest exposure is needed for cooldown decisions.
create table if not exists public.roster_exposures (
  user_id uuid not null references public.users(id) on delete cascade,
  candidate_id uuid not null references public.users(id) on delete cascade,
  shown_at timestamptz not null default now(),
  primary key (user_id, candidate_id),
  constraint roster_exposures_not_self check (user_id <> candidate_id)
);

create index if not exists roster_exposures_user_shown_idx
  on public.roster_exposures (user_id, shown_at desc);
create index if not exists roster_exposures_candidate_shown_idx
  on public.roster_exposures (candidate_id, shown_at desc);

alter table public.roster_exposures enable row level security;
revoke all on table public.roster_exposures from public, anon, authenticated;
grant all on table public.roster_exposures to service_role;
