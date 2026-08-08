-- AI concierge: cache the once-a-day "today's move" per user so the app makes
-- exactly ONE Claude call per user per day (cross-device consistent). Route
-- has a graceful fallback until this runs (recomputes per request, no cache).
alter table users add column if not exists today_move jsonb;
alter table users add column if not exists today_move_at timestamptz;
