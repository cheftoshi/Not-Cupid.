-- Per-user match radius. Default 15mi (tight); users widen in 15mi steps up
-- to 75mi when their pool runs thin. The matcher uses the SEARCHER's radius.
alter table users add column if not exists match_radius int not null default 15;

-- When we last emailed this user "your area is quiet, widen your radius" —
-- dedupes the nudge (3-day cooldown), cleared when they actually widen.
alter table users add column if not exists radius_nudge_sent_at timestamptz;
