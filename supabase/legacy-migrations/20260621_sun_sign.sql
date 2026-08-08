-- Sun signs (6/21) — profile flavor only, never used in matching. Users pick
-- their sign (one of the 12 keys, e.g. 'leo'); no birthdate is stored.
alter table users add column if not exists sun_sign text;
