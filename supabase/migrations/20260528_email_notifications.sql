-- Email notification infrastructure
--
-- Three additions:
--   1. users.email_notifications + notifications_paused_at — per-user opt-out.
--      When set to false, ALL activity emails stop AND the user is removed
--      from the matching pool (pool_active=false) since they can't be
--      notified about matches anyway.
--   2. matches.expiring_reminder_sent_at — set once when the hourly
--      cron sends the "4 hours left to accept" reminder, so we never
--      double-send.
--   3. match_notifications table — tracks the last time we emailed each
--      recipient about a new message in a given match. Used to throttle
--      back-to-back chat emails so a rapid-fire convo doesn't fire 20
--      emails in five minutes.

alter table users add column if not exists email_notifications boolean not null default true;
alter table users add column if not exists notifications_paused_at timestamptz;

alter table matches add column if not exists expiring_reminder_sent_at timestamptz;

create index if not exists matches_expiring_lookup_idx
  on matches (expires_at)
  where status = 'pending' and expiring_reminder_sent_at is null;

create table if not exists match_notifications (
  match_id uuid not null references matches(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  last_message_email_at timestamptz,
  primary key (match_id, recipient_id)
);

grant all on match_notifications to service_role;
alter table match_notifications enable row level security;
