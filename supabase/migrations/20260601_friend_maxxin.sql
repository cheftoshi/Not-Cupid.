-- ============================================================
-- FRIEND MAXXIN — platonic matching backend
-- Opt-in pool, friend quiz (incremental on top of HEXACO + vibes),
-- pairwise mutual connections (5 max), connected-component group chats.
-- ============================================================

-- Opt-in + friend-specific quiz data on users.
alter table users add column if not exists friend_opted_in_at timestamptz;     -- in the friend pool?
alter table users add column if not exists friend_vibes jsonb;                 -- friend quiz answers
alter table users add column if not exists friend_seeking text[] not null default '{}'; -- genders open to befriending; empty = any

create index if not exists users_friend_pool_idx on users(friend_opted_in_at) where friend_opted_in_at is not null;

-- Pairwise friend connections (the match primitive). Canonical ordering a<b so
-- a pair has exactly one row. Mutual pick (a_picked && b_picked) → connected.
create table if not exists friend_connections (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references users(id) on delete cascade,
  user_b_id uuid not null references users(id) on delete cascade,
  a_picked boolean not null default false,
  b_picked boolean not null default false,
  status text not null default 'pending' check (status in ('pending','connected','declined')),
  circle_id uuid,
  compatibility_score int,
  created_at timestamptz not null default now(),
  connected_at timestamptz,
  unique (user_a_id, user_b_id)
);
create index if not exists friend_connections_a_idx on friend_connections(user_a_id);
create index if not exists friend_connections_b_idx on friend_connections(user_b_id);

-- Circles = group chats. One per connected component of the mutual-match graph;
-- mutual matches join/merge circles so a friend-cluster shares one thread.
create table if not exists friend_circles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table if not exists friend_circle_members (
  circle_id uuid not null references friend_circles(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (circle_id, user_id)
);
create index if not exists friend_circle_members_user_idx on friend_circle_members(user_id) where left_at is null;
create index if not exists friend_circle_members_circle_idx on friend_circle_members(circle_id) where left_at is null;

create table if not exists friend_messages (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references friend_circles(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists friend_messages_circle_idx on friend_messages(circle_id, created_at);

-- No-repeat: declined / removed pairs won't resurface in the roster.
create table if not exists friend_match_history (
  user_a_id uuid not null,
  user_b_id uuid not null,
  outcome text,
  created_at timestamptz not null default now(),
  primary key (user_a_id, user_b_id)
);

grant all on friend_connections to service_role;
grant all on friend_circles to service_role;
grant all on friend_circle_members to service_role;
grant all on friend_messages to service_role;
grant all on friend_match_history to service_role;
alter table friend_connections enable row level security;
alter table friend_circles enable row level security;
alter table friend_circle_members enable row level security;
alter table friend_messages enable row level security;
alter table friend_match_history enable row level security;
