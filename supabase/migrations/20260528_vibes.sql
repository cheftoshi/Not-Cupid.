-- Vibes mini-quiz: lifestyle/compat dimensions outside HEXACO.
-- Stored as JSONB so we can iterate without schema churn.

alter table users add column if not exists vibes jsonb;

create index if not exists users_vibes_idx on users using gin (vibes);
