-- Dated Friend Line presence: visitors enter a destination metro without
-- changing their home city. Matching stays segmented by metro and date overlap.
create table if not exists public.friend_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  origin_metro text,
  destination_metro text not null,
  destination_area text,
  starts_on date not null,
  ends_on date not null,
  is_test boolean not null default false,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check ((ends_on - starts_on) <= 60)
);
create unique index if not exists friend_trips_one_active_user_idx
  on public.friend_trips (user_id) where status = 'active';
create index if not exists friend_trips_destination_window_idx
  on public.friend_trips (is_test, destination_metro, status, starts_on, ends_on);
create index if not exists friend_trips_user_idx
  on public.friend_trips (user_id, created_at desc);

alter table public.friend_connections
  add column if not exists match_metro text,
  add column if not exists match_context jsonb not null default '{}'::jsonb,
  add column if not exists match_expires_at timestamptz;
create index if not exists friend_connections_match_metro_idx
  on public.friend_connections (match_metro, created_at desc);
create index if not exists friend_connections_match_expiry_idx
  on public.friend_connections (match_expires_at)
  where status = 'pending' and match_expires_at is not null;

alter table public.friend_intents
  add column if not exists trip_id uuid references public.friend_trips(id) on delete set null;

alter table public.friend_trips enable row level security;
revoke all on table public.friend_trips from public, anon, authenticated;
grant all on table public.friend_trips to service_role;
