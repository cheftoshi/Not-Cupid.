-- ============================================================================
-- BASE SCHEMA — the CORE love-side tables (users, matches, messages, sessions,
-- otp_codes, match_history). These were originally created in the Supabase
-- dashboard and never lived in repo SQL, so apply-all.sql could only ALTER them.
-- This file makes apply-all a (near) true from-zero rebuild: run THIS first,
-- then apply-all.sql.
--
-- ⚠️ RECONSTRUCTED FROM CODE — NOT AUTHORITATIVE. Columns + usage are derived by
-- scanning every .from()/.select()/.insert()/.update()/.eq() and every
-- `alter table` in migrations. Types are best-effort. Before trusting this for
-- disaster recovery, REPLACE it with a real dump of production:
--
--     pg_dump --schema-only --no-owner --no-privileges \
--       -t public.users -t public.matches -t public.messages \
--       -t public.sessions -t public.otp_codes -t public.match_history \
--       "$SUPABASE_DB_URL" > supabase/base-schema.sql
--
--   (SUPABASE_DB_URL = Supabase → Project Settings → Database → Connection string,
--    "URI", session pooler. Keep it out of the repo.)
-- Everything here is `if not exists`, so running it against prod (which already
-- has these tables) is a safe no-op.
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ───────────────────────────── users ─────────────────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- identity / signup
  name text,
  email text unique,
  age int,
  gender text,                 -- m | f | nb | b
  seeking text,                -- m | f | b
  zip text,
  age_min int default 18,
  age_max int default 99,
  -- HEXACO (0–8 after the 12-question trim)
  score_honesty int,
  score_emotionality int,
  score_extraversion int,
  score_agreeableness int,
  score_conscientiousness int,
  score_openness int,
  archetype text,
  relationship_style text,
  vibes jsonb,
  -- quiz v2
  attach_anxiety int,
  attach_avoidance int,
  attach_style text,
  values_profile jsonb,
  -- profile
  photo_url text,
  gallery text[] default '{}',
  bio text,
  occupation text,
  music text[] default '{}',
  food text[] default '{}',
  hobbies text[] default '{}',
  -- matching pool / radius / equity
  status text default 'waiting',
  pool_active boolean default true,
  match_radius int default 15,
  radius_nudge_sent_at timestamptz,
  balance_hold_at timestamptz,
  last_matched_at timestamptz,
  roster_snapshot text[] default '{}',
  roster_refreshed_at timestamptz,
  -- ghost / cooldown / blocking
  ghost_reports_received int default 0,
  ghost_strikes int default 0,
  matching_cooldown_until timestamptz,
  matching_disabled_at timestamptz,
  is_blocked boolean default false,
  -- email / notifications
  email_notifications boolean default true,
  -- blast/reminder bookkeeping
  quiz_blast_sent_at timestamptz,
  relaunch_blast_sent_at timestamptz,
  friend_digest_sent_at timestamptz,
  -- profile management
  profile_refresh_count int default 0,
  auto_rematch boolean default true,        -- legacy (unused; pausing via unsubscribe)
  hexaco_unlocked boolean default false,    -- legacy single-unlock flag
  -- friend line
  friend_opted_in_at timestamptz,
  friend_vibes jsonb,
  friend_seeking text[] default '{}',
  friend_age_min int,
  friend_age_max int,
  friend_waitlist_at timestamptz,
  friend_pro_until timestamptz,
  friend_sub_id text,
  stripe_customer_id text,
  is_lgbtq boolean,
  -- ops
  is_test boolean default false,
  deleted_at timestamptz
);
create index if not exists users_email_idx on users(lower(email));
create index if not exists users_pool_idx on users(pool_active) where deleted_at is null;

-- ───────────────────────────── matches ─────────────────────────────
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_1_id uuid not null references users(id) on delete cascade,
  user_2_id uuid not null references users(id) on delete cascade,
  user_1_accepted boolean default false,
  user_2_accepted boolean default false,
  status text default 'pending',            -- pending|both_accepted|passed|ended|expired|matched
  compatibility_score int,
  expires_at timestamptz,                    -- 72h accept window
  chat_expires_at timestamptz,               -- 36h inactivity window
  ended_at timestamptz,
  ended_reason text,
  expiring_reminder_sent_at timestamptz
);
create index if not exists matches_user1_open_idx on matches(user_1_id) where ended_at is null;
create index if not exists matches_user2_open_idx on matches(user_2_id) where ended_at is null;

-- ───────────────────────────── messages ─────────────────────────────
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  match_id uuid not null references matches(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null
);
create index if not exists messages_match_created_idx on messages(match_id, created_at);

-- ───────────────────────────── sessions ─────────────────────────────
create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on sessions(user_id);

-- ───────────────────────────── otp_codes ─────────────────────────────
create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  code text not null,
  verified boolean not null default false,
  expires_at timestamptz not null
);
create index if not exists otp_codes_email_created_idx on otp_codes(email, created_at desc);

-- ───────────────────────────── match_history ─────────────────────────────
-- One row per ever-matched pair (sorted ids) → roster never re-surfaces them.
create table if not exists match_history (
  user_a_id uuid not null,
  user_b_id uuid not null,
  match_id uuid,
  outcome text,
  created_at timestamptz not null default now(),
  primary key (user_a_id, user_b_id)
);
create index if not exists match_history_user_a_idx on match_history(user_a_id);
create index if not exists match_history_user_b_idx on match_history(user_b_id);
