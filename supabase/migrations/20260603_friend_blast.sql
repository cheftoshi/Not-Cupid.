-- Track who got the "Friend Line is live" launch email (idempotent + resumable).
alter table users add column if not exists friend_blast_sent_at timestamptz;
create index if not exists users_friend_blast_unsent_idx on users(id) where friend_blast_sent_at is null;
