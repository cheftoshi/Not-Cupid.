-- Summer of Connection — event raffle (6/22). Two entrants are drawn by the
-- matching algo (hobbies-weighted); on mutual accept they win a $200 date.
create table if not exists raffle_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  event_key text not null default 'boston-2026-07-02',
  video_url text,
  notify boolean not null default true,
  status text not null default 'entered' check (status in ('entered','picked','passed')),
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index if not exists raffle_entries_event_idx on raffle_entries(event_key, status);

create table if not exists raffle_draws (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  user_a_id uuid not null references users(id) on delete cascade,
  user_b_id uuid not null references users(id) on delete cascade,
  compatibility_score int,
  a_accepted boolean not null default false,
  b_accepted boolean not null default false,
  status text not null default 'pending' check (status in ('pending','both_accepted','declined','expired')),
  restaurant text,
  happens_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_key, user_a_id, user_b_id)
);
create index if not exists raffle_draws_users_idx on raffle_draws(user_a_id, user_b_id);
