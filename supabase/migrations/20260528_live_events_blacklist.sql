-- Admin blacklist for the live-events feed.
--
-- The date-vibes deck pulls live local events from external sources
-- (Ticketmaster, Yelp, Boston Calendar). Rule-based filters catch most
-- junk automatically (venue whitelist, classification, on-sale status,
-- time window), but admins can hide specific items from the deck if
-- something inappropriate slips through.
--
-- Hidden items stay hidden permanently — the activity_id is stable per
-- source so we never have to re-hide the same event.

create table if not exists live_activity_blacklist (
  activity_id text primary key,
  hidden_by uuid references users(id) on delete set null,
  hidden_at timestamptz not null default now(),
  reason text
);

grant all on live_activity_blacklist to service_role;
alter table live_activity_blacklist enable row level security;
