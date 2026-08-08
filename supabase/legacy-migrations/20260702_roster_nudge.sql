-- Heartbeat push throttle: when the daily nudge tells a love-line user their
-- roster has fresh people, stamp it here so non-openers get pinged at most
-- every ~3 days, never daily spam.
alter table users add column if not exists roster_nudged_at timestamptz;
