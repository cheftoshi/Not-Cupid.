-- Pool rotation: wave drops + activity ejection
-- A user must have pool_active=true to be eligible for matching.
-- The rematch cron toggles this based on activity + wave logic.

alter table users add column if not exists pool_active boolean not null default true;
alter table users add column if not exists pool_drop_at timestamptz;

create index if not exists users_pool_active_idx on users(pool_active, status);
create index if not exists users_pool_drop_at_idx on users(pool_drop_at);

-- Helpful index for the activity-ejection query
create index if not exists sessions_user_last_used_idx on sessions(user_id, last_used_at desc);
