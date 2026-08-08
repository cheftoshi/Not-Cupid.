-- Friend Maxxin paywall: $2.99 one-time "founding member" unlock.
-- Free access for 7 days from friend_opted_in_at (everything EXCEPT the group
-- chat); the chat requires founding. After 7 days, founding unlocks everything.
alter table users add column if not exists friend_paid_at timestamptz;
