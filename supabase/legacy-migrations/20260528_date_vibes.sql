-- "Date vibes" surface — interactive activity-picking game between two
-- matched users.
--
-- Flow:
--   1. Each user picks 3-5 interests (food/music/sports/...) for THIS match.
--      Stored in match_date_vibes (one row per match × user).
--   2. They independently swipe yes/no on activities from a deck filtered
--      by their combined interests. Each swipe stored in activity_swipes
--      (one row per match × user × activity).
--   3. When BOTH users have swiped 'yes' on the same activity_id, that's
--      a "mutual match" — computed on read by joining activity_swipes
--      against itself.
--
-- activity_id is a string ('curated:walk-esplanade' or
-- 'live:ticketmaster:K8vZ9173f-Z') because activities come from both a
-- code-defined curated catalog and live external feeds — no point in a
-- separate activities table since the curated source of truth is code
-- and the live feed is fetched JIT.

create table if not exists match_date_vibes (
  match_id uuid not null references matches(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  interests text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table if not exists activity_swipes (
  match_id uuid not null references matches(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  activity_id text not null,
  decision text not null check (decision in ('yes', 'no')),
  created_at timestamptz not null default now(),
  primary key (match_id, user_id, activity_id)
);

-- For fast "what did both users say yes to?" lookups.
create index if not exists activity_swipes_match_yes_idx
  on activity_swipes (match_id, activity_id)
  where decision = 'yes';

grant all on match_date_vibes to service_role;
grant all on activity_swipes to service_role;
alter table match_date_vibes enable row level security;
alter table activity_swipes enable row level security;
