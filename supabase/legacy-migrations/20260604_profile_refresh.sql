-- Profile refresh: let a user wipe their quiz + profile + matches and start
-- over, capped at 3 times per account (tracked on the user row, so it's
-- per-email/unique). Counts up; the endpoint refuses past 3.
alter table users add column if not exists profile_refresh_count int not null default 0;
