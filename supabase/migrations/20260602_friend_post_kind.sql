-- Distinguish a "post" (just talk to the network) from an "event" (RSVP in/out).
-- Existing rows are events (they were created with a time + RSVP semantics).
alter table friend_activities add column if not exists kind text not null default 'event'
  check (kind in ('post', 'event'));
create index if not exists friend_activities_kind_idx on friend_activities(kind);
