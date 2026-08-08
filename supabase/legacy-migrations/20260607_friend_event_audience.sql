-- Friend Line events can target an audience (gender + age), and RSVPs become
-- yes / maybe / no instead of a binary "in".

-- Audience targeting on events (null = open to everyone / no bound).
alter table friend_activities add column if not exists audience_gender text[];
alter table friend_activities add column if not exists audience_age_min int;
alter table friend_activities add column if not exists audience_age_max int;

-- yes / maybe / no on each RSVP. Existing rows were "in" → 'yes'.
alter table friend_activity_rsvps add column if not exists response text not null default 'yes'
  check (response in ('yes', 'maybe', 'no'));

-- Daily digest bookkeeping: when we last emailed a user the Friend Line digest
-- (so the cron can throttle to ~24h).
alter table users add column if not exists friend_digest_sent_at timestamptz;
