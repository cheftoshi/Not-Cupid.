-- CONSOLIDATED IDEMPOTENT MIGRATION — apply all schema in order.
-- Safe to re-run: every statement is 'if not exists' or drop-then-add.
-- Generated 2026-05-31 to resync production schema with code.
--
-- ⚠️ RUN `supabase/base-schema.sql` FIRST. The CORE love-side tables — `users`,
-- `matches`, `messages`, `sessions`, `otp_codes`, `match_history` — were created
-- in the Supabase dashboard and aren't created here; this file only ALTERs/
-- indexes them. `base-schema.sql` is the authoritative pg_dump of those 6 tables
-- (captured 2026-06-17, PG 17.6). Fresh env = base-schema.sql, then this file.
-- Everything else (friend_*, unlocks, push_subscriptions, aux, functions) IS here.

-- ==================== 20260527_security_hardening.sql ====================
-- Security hardening migration
-- Run this against your Supabase project before deploying the matching security code.

-- 1. Rate limit table: keyed by an arbitrary string (email, ip, or composite).
--    `count` is incremented on each attempt; `window_start` resets when the window expires.
create table if not exists rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now(),
  blocked_until timestamptz
);

-- 2. Stripe webhook idempotency: prevent replay of valid Stripe events.
create table if not exists stripe_events (
  event_id text primary key,
  type text,
  received_at timestamptz not null default now()
);

-- 3. Index for cleaning up expired OTP codes (optional but useful).
create index if not exists otp_codes_email_created_idx
  on otp_codes (email, created_at desc);

-- ==================== 20260528_date_vibes.sql ====================
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

-- ==================== 20260528_email_notifications.sql ====================
-- Email notification infrastructure
--
-- Three additions:
--   1. users.email_notifications + notifications_paused_at — per-user opt-out.
--      When set to false, ALL activity emails stop AND the user is removed
--      from the matching pool (pool_active=false) since they can't be
--      notified about matches anyway.
--   2. matches.expiring_reminder_sent_at — set once when the hourly
--      cron sends the "4 hours left to accept" reminder, so we never
--      double-send.
--   3. match_notifications table — tracks the last time we emailed each
--      recipient about a new message in a given match. Used to throttle
--      back-to-back chat emails so a rapid-fire convo doesn't fire 20
--      emails in five minutes.

alter table users add column if not exists email_notifications boolean not null default true;
alter table users add column if not exists notifications_paused_at timestamptz;

alter table matches add column if not exists expiring_reminder_sent_at timestamptz;

create index if not exists matches_expiring_lookup_idx
  on matches (expires_at)
  where status = 'pending' and expiring_reminder_sent_at is null;

create table if not exists match_notifications (
  match_id uuid not null references matches(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  last_message_email_at timestamptz,
  primary key (match_id, recipient_id)
);

grant all on match_notifications to service_role;
alter table match_notifications enable row level security;

-- ==================== 20260528_end_match_flow.sql ====================
-- End-match flow: date feedback + ghosting reports + matching cooldown

-- Ghost / cooldown tracking on the user being reported
alter table users add column if not exists ghost_reports_received int not null default 0;
alter table users add column if not exists matching_cooldown_until timestamptz;
alter table users add column if not exists matching_disabled_at timestamptz;
-- Permanent lifetime ghost counter (reactivate can't zero it; drives escalation + hard cap)
alter table users add column if not exists ghost_strikes int not null default 0;

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

-- ==================== 20260528_friend_waitlist.sql ====================
-- Friend Maxxin waitlist: track interest from existing NotCupid users
-- (anonymous waitlist signups via email collected separately if needed).

alter table users add column if not exists friend_waitlist_at timestamptz;

create index if not exists users_friend_waitlist_idx on users(friend_waitlist_at)
  where friend_waitlist_at is not null;

-- ==================== 20260528_live_events_blacklist.sql ====================
-- Admin blacklist for the live-events feed.
--
-- The date-vibes deck pulls live local events from external sources
-- (Ticketmaster, Yelp, Boston Calendar). Rule-based filters catch most
-- junk automatically (venue whitelist, classification, on-sale status,
-- time window), but admins can hide specific items from the deck if
-- something inappropriate slips through.
--
-- Hidden items stay hidden permanently — the activity_id is stable per
-- source so we never have to re-hide the same event.

create table if not exists live_activity_blacklist (
  activity_id text primary key,
  hidden_by uuid references users(id) on delete set null,
  hidden_at timestamptz not null default now(),
  reason text
);

grant all on live_activity_blacklist to service_role;
alter table live_activity_blacklist enable row level security;

-- ==================== 20260528_match_constraint_fix.sql ====================
-- Allow the new ended_reason values from the end-match flow.
-- The original matches_status_check rejected 'ghosted' / 'not_vibing' / 'user_ended'.

alter table matches drop constraint if exists matches_status_check;

alter table matches add constraint matches_status_check
  check (status in (
    'pending',
    'both_accepted',
    'active',
    'passed',
    'ended',
    'expired',
    'matched'
  ));

-- NOTE: the ended_reason CHECK from this 5/28 migration is intentionally
-- omitted here — it predates the 'reported' value now present in live data
-- and would fail. The authoritative ended_reason constraint (including
-- 'reported') is set by the 20260531_reports.sql section below.

-- ==================== 20260528_pool_rotation.sql ====================
-- Pool rotation: wave drops + activity ejection
-- A user must have pool_active=true to be eligible for matching.
-- The rematch cron toggles this based on activity + wave logic.

alter table users add column if not exists pool_active boolean not null default true;
alter table users add column if not exists pool_drop_at timestamptz;

create index if not exists users_pool_active_idx on users(pool_active, status);
create index if not exists users_pool_drop_at_idx on users(pool_drop_at);

-- Helpful index for the activity-ejection query
create index if not exists sessions_user_last_used_idx on sessions(user_id, last_used_at desc);

-- ==================== 20260528_profile_gallery.sql ====================
-- Profile gallery: up to 3 additional photos per user, beyond the single
-- primary photo_url. These are part of the $2.99 unlock — a matched user
-- only sees them after paying. The primary photo stays always-visible.
--
-- Stored as an array of public storage URLs (max 3 enforced in the API).

alter table users add column if not exists gallery text[] not null default '{}';

-- ==================== 20260528_quiz_blast_tracking.sql ====================
-- Track which users have received the "retake the quiz" email so re-running
-- the blast only targets people we haven't reached yet.

alter table users add column if not exists quiz_blast_sent_at timestamptz;

create index if not exists users_quiz_blast_unsent_idx on users(id)
  where quiz_blast_sent_at is null;

-- ==================== 20260528_relationship_style.sql ====================
-- Add a single-select "relationship style" field so users can self-identify as
-- DINK, ENM/poly, marriage-track, casual, etc. Separate from the existing
-- "future" vibe (which is a seriousness-of-intent scale) — this captures the
-- shape of the relationship someone wants, not the timeline.
--
-- Nullable so existing users don't need a backfill; the quiz and profile form
-- both prompt for it going forward.

alter table users add column if not exists relationship_style text;

-- Constrain to known values. Easy to extend later by altering the check.
alter table users drop constraint if exists users_relationship_style_check;
alter table users add constraint users_relationship_style_check
  check (
    relationship_style is null
    or relationship_style in ('marriage_track', 'dink', 'enm_poly', 'casual', 'open')
  );

create index if not exists users_relationship_style_idx on users(relationship_style);

-- ==================== 20260528_vibes.sql ====================
-- Vibes mini-quiz: lifestyle/compat dimensions outside HEXACO.
-- Stored as JSONB so we can iterate without schema churn.

alter table users add column if not exists vibes jsonb;

create index if not exists users_vibes_idx on users using gin (vibes);

-- ==================== 20260529_feedback.sql ====================
-- User feedback drop (from the dashboard "send feedback" spot).
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on feedback(created_at desc);
grant all on feedback to service_role;
alter table feedback enable row level security;

-- ==================== 20260529_match_radius.sql ====================
-- Per-user match radius. Default 15mi (tight); users widen in 15mi steps up
-- to 75mi when their pool runs thin. The matcher uses the SEARCHER's radius.
alter table users add column if not exists match_radius int not null default 15;

-- When we last emailed this user "your area is quiet, widen your radius" —
-- dedupes the nudge (3-day cooldown), cleared when they actually widen.
alter table users add column if not exists radius_nudge_sent_at timestamptz;

-- ==================== 20260529_pool_balance.sql ====================
-- Pool freshness: gender-balance intake gating + equity rotation.
--
-- balance_hold_at: set when a new over-represented-gender signup is put on a
--   soft "early access" hold in a skewed metro (pool_active=false). The cron
--   releases them as the scarce side joins, or after a 3-day cap. Null = not
--   balance-held. Users never see a "you're held because too many men"
--   message — they just see the normal positive "in the queue" state.
--
-- last_matched_at: when this user was last put into a match. Drives equity
--   rotation — the matcher boosts candidates who haven't matched recently so
--   the same high-scoring people don't monopolize the scarce side.

alter table users add column if not exists balance_hold_at timestamptz;
alter table users add column if not exists last_matched_at timestamptz;

create index if not exists users_balance_hold_idx on users(balance_hold_at) where balance_hold_at is not null;

-- ==================== 20260531_relaunch_blast.sql ====================
-- Track who received the "we relaunched matching" announcement blast so
-- re-running it only targets people we haven't reached yet (idempotent +
-- resumable, same pattern as quiz_blast_sent_at).

alter table users add column if not exists relaunch_blast_sent_at timestamptz;

create index if not exists users_relaunch_blast_unsent_idx on users(id)
  where relaunch_blast_sent_at is null;

-- ==================== 20260531_reports.sql ====================
-- Block & report — core safety feature.
--
-- user_reports: one row per (reporter → reported) report, with a reason and
-- optional detail. The reported pair is also written to match_history so the
-- matcher never pairs them again (reuses the existing no-repeat path).
--
-- users.is_blocked: a hard platform block set by admin after reviewing
-- reports — excludes the user from matching entirely (separate from the
-- ghost-driven matching_disabled_at so admins can distinguish the reason).

create table if not exists user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id) on delete cascade,
  reported_id uuid not null references users(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  reason text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists user_reports_reported_idx on user_reports(reported_id);
create index if not exists user_reports_created_idx on user_reports(created_at desc);
grant all on user_reports to service_role;
alter table user_reports enable row level security;

alter table users add column if not exists is_blocked boolean not null default false;

-- Allow 'reported' as a match ended_reason (the report flow ends the match).
alter table matches drop constraint if exists matches_ended_reason_check;
alter table matches add constraint matches_ended_reason_check
  check (ended_reason in (
    'expired','one_passed','mutual_pass','completed','user_deleted',
    'user_ended','ghosted','not_vibing','user_requiz','reported'
  ));

-- ==================== 20260531_roster_snapshot.sql ====================
-- Roster stability: persist each user's current roster so it doesn't reshuffle
-- on every page load. The snapshot rotates at most every 12h (or sooner when
-- members get taken and we backfill). roster_snapshot holds candidate user ids
-- in display order; roster_refreshed_at is when it was last fully recomputed.
alter table users add column if not exists roster_snapshot text[] not null default '{}';
alter table users add column if not exists roster_refreshed_at timestamptz;


-- ==================== unlock tables (were dashboard-created) ====================
-- `match_unlocks`: current per-(user,match) unlock state (lib/record-unlock).
-- `unlocks`: legacy payment ledger still read by admin stats + written by the
-- stripe webhook. Both were created in the dashboard and missing from this file;
-- folded in idempotently so admin reads don't break + a rebuild includes them.
create table if not exists match_unlocks (
  user_id uuid not null,
  match_id uuid not null,
  unlocked_user_id uuid,
  amount_cents int,
  stripe_payment_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, match_id)
);
create table if not exists unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  stripe_payment_id text,
  amount int,
  created_at timestamptz not null default now()
);
alter table match_unlocks enable row level security;
alter table unlocks enable row level security;

-- ==================== 20260531_unlock_tiers.sql ====================
-- Two-tier match unlock:
--   $0.99 hexaco_unlocked  → reveal the match's HEXACO personality bars
--   $1.99 profile_unlocked → reveal the full profile (gallery, bio, music, …)
-- $1.99 is a superset: profile_unlocked also implies HEXACO is visible.
-- Kept as two booleans on the existing one-row-per-(user,match) shape so we
-- don't have to change the (user_id, match_id) upsert key.

alter table match_unlocks add column if not exists hexaco_unlocked boolean not null default false;
alter table match_unlocks add column if not exists profile_unlocked boolean not null default false;

-- Backfill: any pre-existing row was the old single $2.99 full unlock.
-- Guarded so re-running can't clobber a later hexaco-only row.
update match_unlocks
  set profile_unlocked = true
  where profile_unlocked = false and hexaco_unlocked = false;

-- ==================== 20260531_date_feedback_fix.sql ====================
-- Fix: date_feedback existed in prod (early partial run) WITHOUT the rating
-- columns, so the later `create table if not exists` was skipped and never
-- added them. The admin date-feedback panel errors on date_feedback.rating.
-- Patch the existing table explicitly. Nullable (can't add NOT NULL to a table
-- that may have rows without a default); the API already validates rating 1-5.

alter table date_feedback add column if not exists rating int;
alter table date_feedback add column if not exists would_again boolean;
alter table date_feedback add column if not exists notes text;
alter table date_feedback add column if not exists created_at timestamptz not null default now();

-- ==================== 20260531_page_views.sql ====================
-- First-party pageview tracking for the in-admin "web traffic" view.
-- One row per client route change (anonymous-friendly; anon_id is a random
-- localStorage id, NOT tied to identity). Low-volume early-stage; roll up later
-- if it grows. Vercel Analytics still covers raw traffic — this is the
-- in-dashboard slice.

create table if not exists page_views (
  id bigint generated always as identity primary key,
  path text not null,
  anon_id text,
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_idx on page_views(created_at desc);
create index if not exists page_views_path_idx on page_views(path);

grant all on page_views to service_role;
alter table page_views enable row level security;

-- ==================== 20260531_test_accounts.sql ====================
-- Test accounts: flag throwaway users so the magic dev-login can ONLY ever
-- create a session for a test account, never a real user (the hard safety gate).
alter table users add column if not exists is_test boolean not null default false;
create index if not exists users_is_test_idx on users(is_test) where is_test = true;

-- ==================== 20260601_friend_maxxin.sql ====================
-- Friend Line core: opt-in + quiz data on users, pairwise connections, circles
-- (group chats), messages, and no-repeat history. (Was never folded in — these
-- tables exist in prod from the migration, but apply-all needs them to be a
-- complete from-zero rebuild, and friend_chat_unlocks below FKs friend_circles.)
alter table users add column if not exists friend_opted_in_at timestamptz;
alter table users add column if not exists friend_vibes jsonb;
alter table users add column if not exists friend_seeking text[] not null default '{}';
create index if not exists users_friend_pool_idx on users(friend_opted_in_at) where friend_opted_in_at is not null;

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

create table if not exists friend_match_history (
  user_a_id uuid not null,
  user_b_id uuid not null,
  outcome text,
  created_at timestamptz not null default now(),
  primary key (user_a_id, user_b_id)
);

-- ==================== 20260601_friend_activities.sql ====================
-- Friend Line activity board ("the Scene") + RSVPs. (kind / audience / response
-- columns are added by the 20260602 + 20260607 blocks further down.)
create table if not exists friend_activities (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text,
  category text not null default 'hang' check (category in
    ('food','drinks','active','outdoors','culture','nightlife','games','chill','hang')),
  area text,
  happens_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists friend_activities_live_idx on friend_activities(expires_at, created_at desc);
create index if not exists friend_activities_area_idx on friend_activities(area);
create index if not exists friend_activities_cat_idx on friend_activities(category);

create table if not exists friend_activity_rsvps (
  activity_id uuid not null references friend_activities(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);
create index if not exists friend_activity_rsvps_act_idx on friend_activity_rsvps(activity_id);

-- ==================== 20260604_friend_match_rounds.sql ====================
-- The $0.99 "another round of matches" purchases (idempotent per Stripe payment).
create table if not exists friend_match_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  stripe_payment_id text unique,
  created_at timestamptz not null default now()
);
create index if not exists friend_match_rounds_user_idx on friend_match_rounds (user_id);

-- ==================== 20260602_friend_billing.sql ====================
-- Friend Maxxin billing v2: per-crew $0.99 chat unlocks + $2.99/mo Pro subscription.
-- Replaces the one-time "founding" model (friend_paid_at kept for back-compat:
-- anyone who already paid founding is grandfathered into Pro-equivalent access).

-- Pro subscription window. Renewals push this forward; cancel lets it lapse.
alter table users add column if not exists friend_pro_until timestamptz;
alter table users add column if not exists stripe_customer_id text;
alter table users add column if not exists friend_sub_id text;          -- active subscription id (null when canceled)

-- One row per (user, circle) the user has paid $0.99 to unlock the chat for.
create table if not exists friend_chat_unlocks (
  user_id uuid not null references users(id) on delete cascade,
  circle_id uuid not null references friend_circles(id) on delete cascade,
  stripe_payment_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, circle_id)
);
create index if not exists friend_chat_unlocks_user_idx on friend_chat_unlocks(user_id);
grant all on friend_chat_unlocks to service_role;
alter table friend_chat_unlocks enable row level security;

-- ==================== 20260604_feedback_reply.sql ====================
-- Admin reply to user feedback (emails the user + stamps the reply).
alter table feedback add column if not exists replied_at timestamptz;
alter table feedback add column if not exists reply_body text;

-- ==================== 20260604_friend_age_pref.sql ====================
-- Friend Line age preference (symmetric, NULL = no bound).
alter table users add column if not exists friend_age_min int;
alter table users add column if not exists friend_age_max int;

-- ==================== 20260604_profile_refresh.sql ====================
-- Profile refresh counter (max 3 full resets per account).
alter table users add column if not exists profile_refresh_count int not null default 0;

-- ==================== 20260605_ghost_strikes.sql ====================
-- Permanent lifetime ghost counter (reactivate can't zero it; drives escalation + hard cap).
alter table users add column if not exists ghost_strikes int not null default 0;

-- ==================== 20260606_rls_core_tables.sql ====================
-- Defense-in-depth: RLS deny-by-default on sensitive tables. Safe because the
-- app uses the SERVICE key (bypasses RLS) and the anon client never queries
-- tables. RULE: never query tables with the anon `supabase` client client-side.
alter table if exists users                  enable row level security;
alter table if exists sessions               enable row level security;
alter table if exists otp_codes              enable row level security;
alter table if exists matches                enable row level security;
alter table if exists messages               enable row level security;
alter table if exists match_history          enable row level security;
alter table if exists end_reports            enable row level security;
alter table if exists user_reports           enable row level security;
alter table if exists feedback               enable row level security;
alter table if exists inbound_messages       enable row level security;
alter table if exists match_date_vibes       enable row level security;
alter table if exists activity_swipes        enable row level security;
alter table if exists live_activity_blacklist enable row level security;
alter table if exists page_views             enable row level security;
alter table if exists friend_circles         enable row level security;
alter table if exists friend_circle_members  enable row level security;
alter table if exists friend_messages        enable row level security;
alter table if exists friend_connections     enable row level security;
alter table if exists friend_match_history   enable row level security;
alter table if exists friend_activities      enable row level security;
alter table if exists friend_activity_rsvps  enable row level security;
alter table if exists friend_chat_unlocks    enable row level security;
alter table if exists friend_match_rounds    enable row level security;

-- ==================== 20260602_friend_post_kind.sql ====================
-- post vs event distinction (was never folded into apply-all — caused a
-- "could not find the 'kind' column" error when posting events).
alter table friend_activities add column if not exists kind text not null default 'event'
  check (kind in ('post', 'event'));
create index if not exists friend_activities_kind_idx on friend_activities(kind);

-- ==================== 20260607_friend_event_audience.sql ====================
-- Event audience targeting (gender + age) + yes/maybe/no RSVPs + digest stamp.
alter table friend_activities add column if not exists audience_gender text[];
alter table friend_activities add column if not exists audience_age_min int;
alter table friend_activities add column if not exists audience_age_max int;
alter table friend_activity_rsvps add column if not exists response text not null default 'yes'
  check (response in ('yes', 'maybe', 'no'));
alter table users add column if not exists friend_digest_sent_at timestamptz;

-- ==================== 20260608_friend_lgbtq.sql ====================
-- Self-ID so LGBTQ+ audiences/seeking gate accurately (null = unset → gender fallback).
alter table users add column if not exists is_lgbtq boolean;

-- ==================== 20260609_quiz_v2.sql ====================
-- Quiz v2: attachment + values (the dimensions that actually predict compatibility).
alter table users add column if not exists attach_anxiety int;
alter table users add column if not exists attach_avoidance int;
alter table users add column if not exists attach_style text;
alter table users add column if not exists values_profile jsonb;

-- ───────────────────────── 20260610_perf_indexes ─────────────────────────
-- Hot-path indexes: chat polling, open-match lookups, pending sweeps, history.
create index if not exists messages_match_created_idx
  on messages (match_id, created_at);
create index if not exists matches_user1_open_idx
  on matches (user_1_id) where ended_at is null;
create index if not exists matches_user2_open_idx
  on matches (user_2_id) where ended_at is null;
create index if not exists matches_pending_created_idx
  on matches (created_at) where status = 'pending';
create index if not exists match_history_user_a_idx on match_history (user_a_id);
create index if not exists match_history_user_b_idx on match_history (user_b_id);

-- ──────────────────────── 20260611_push_subscriptions ────────────────────────
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on push_subscriptions(user_id);
alter table push_subscriptions enable row level security;

-- ──────────────────────── 20260617_activity_rsvp_counts ────────────────────────
-- Per-activity RSVP tallies via DB aggregate (was an O(all-rsvps) fetch in JS).
create or replace function activity_rsvp_counts(p_ids uuid[])
returns table (activity_id uuid, yes int, maybe int, no int)
language sql
stable
as $$
  select
    activity_id,
    count(*) filter (where coalesce(response, 'yes') = 'yes')::int   as yes,
    count(*) filter (where coalesce(response, 'yes') = 'maybe')::int as maybe,
    count(*) filter (where coalesce(response, 'yes') = 'no')::int    as no
  from friend_activity_rsvps
  where activity_id = any(p_ids)
  group by activity_id
$$;

-- ──────────────────────── 20260619_ignored_picks ────────────────────────
-- Responsiveness gate: bench chronic no-shows (got picked, never accepted) from
-- rosters once they've ignored > MAX_IGNORED_PICKS picks. Resets on any accept.
alter table users add column if not exists ignored_picks int not null default 0;
create or replace function bump_ignored_picks(p_id uuid)
returns void
language sql
as $$
  update users set ignored_picks = ignored_picks + 1 where id = p_id;
$$;
