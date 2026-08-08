-- Friend Maxxin waitlist: track interest from existing NotCupid users
-- (anonymous waitlist signups via email collected separately if needed).

alter table users add column if not exists friend_waitlist_at timestamptz;

create index if not exists users_friend_waitlist_idx on users(friend_waitlist_at)
  where friend_waitlist_at is not null;
