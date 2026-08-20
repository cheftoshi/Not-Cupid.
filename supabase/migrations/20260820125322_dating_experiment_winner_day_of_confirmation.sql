-- Day-of winner attendance confirmations are separate from sealed shortlist
-- choices. Email scanners may open links, so only the explicit POST from the
-- confirmation page records a response.

create table if not exists public.dating_experiment_winner_confirmations (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.raffle_draws(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  response text not null check (response in ('still_in', 'cant_make_it')),
  responded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draw_id, user_id)
);

create index if not exists dating_experiment_winner_confirmations_draw_idx
  on public.dating_experiment_winner_confirmations (draw_id, responded_at desc);

alter table public.dating_experiment_winner_confirmations enable row level security;
revoke all on table public.dating_experiment_winner_confirmations from public, anon, authenticated;
grant all on table public.dating_experiment_winner_confirmations to service_role;

comment on table public.dating_experiment_winner_confirmations is
  'Service-only day-of attendance responses from signed winner confirmation pages.';
