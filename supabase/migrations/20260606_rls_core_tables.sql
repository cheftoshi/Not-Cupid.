-- Defense-in-depth: enable Row Level Security (DENY-BY-DEFAULT) on every
-- sensitive table. With RLS on and NO policies, the `anon` and `authenticated`
-- Postgres roles can read/write NOTHING. The app is unaffected because it talks
-- to the DB exclusively via the SERVICE key (which bypasses RLS), and the anon
-- Supabase client is never used to query tables from the browser.
--
-- This is the safety net for the one-mistake-away scenario: if anyone ever wires
-- the anon client into a client component, these tables stay locked instead of
-- becoming world-readable. `if exists` keeps it safe to run on any environment.
--
-- ⚠️ RULE TO KEEP: never query Supabase tables with the anon `supabase` client
-- from a 'use client' file. If you ever need authenticated client-side reads,
-- add explicit `create policy` statements first.

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
