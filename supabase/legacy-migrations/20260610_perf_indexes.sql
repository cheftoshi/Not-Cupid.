-- Perf indexes for the hot read paths (2026-06-10).
--
-- messages: the chat polls GET /api/messages every 3s per open chat — without
-- this index every poll scans the table.
create index if not exists messages_match_created_idx
  on messages (match_id, created_at);

-- matches: nearly every matching query filters "user_1_id = X OR user_2_id = X"
-- with ended_at is null. Postgres can OR two single-column partial indexes.
create index if not exists matches_user1_open_idx
  on matches (user_1_id) where ended_at is null;
create index if not exists matches_user2_open_idx
  on matches (user_2_id) where ended_at is null;

-- pending-expiry sweeps (cron + releaseTimedOutMatches)
create index if not exists matches_pending_created_idx
  on matches (created_at) where status = 'pending';

-- match_history: roster exclusion reads all pairs touching a user.
create index if not exists match_history_user_a_idx on match_history (user_a_id);
create index if not exists match_history_user_b_idx on match_history (user_b_id);
