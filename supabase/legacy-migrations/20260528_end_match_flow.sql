-- End-match flow: date feedback + ghosting reports + matching cooldown

-- Ghost / cooldown tracking on the user being reported
alter table users add column if not exists ghost_reports_received int not null default 0;
alter table users add column if not exists matching_cooldown_until timestamptz;
alter table users add column if not exists matching_disabled_at timestamptz;

-- Date feedback per (match, reporting user). Each user gets one row per match.
create table if not exists date_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  would_again boolean,
  notes text,
  created_at timestamptz not null default now(),
  unique(match_id, user_id)
);

create index if not exists date_feedback_user_idx on date_feedback(user_id);
create index if not exists date_feedback_match_idx on date_feedback(match_id);

-- service_role access (we hit this via supabaseAdmin)
grant all on date_feedback to service_role;
alter table date_feedback enable row level security;

-- Optional: store the most recent end-reason from a user against the other (for admin moderation context)
create table if not exists end_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  reporter_id uuid not null references users(id) on delete cascade,
  target_id uuid not null references users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists end_reports_target_idx on end_reports(target_id);
create index if not exists end_reports_match_idx on end_reports(match_id);
grant all on end_reports to service_role;
alter table end_reports enable row level security;
