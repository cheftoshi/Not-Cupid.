-- Roster stability: persist each user's current roster so it doesn't reshuffle
-- on every page load. The snapshot rotates at most every 12h (or sooner when
-- members get taken and we backfill). roster_snapshot holds candidate user ids
-- in display order; roster_refreshed_at is when it was last fully recomputed.
alter table users add column if not exists roster_snapshot text[] not null default '{}';
alter table users add column if not exists roster_refreshed_at timestamptz;
