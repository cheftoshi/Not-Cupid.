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
