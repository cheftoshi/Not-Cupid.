-- Read receipts + unread badges.
-- Love chat: per-side read stamps on the match (poll marks mine, returns theirs).
alter table matches add column if not exists user_1_read_at timestamptz;
alter table matches add column if not exists user_2_read_at timestamptz;

-- Friend DMs: per-user read stamp per thread (pairwise).
create table if not exists friend_dm_reads (
  user_id uuid not null references users(id) on delete cascade,
  other_id uuid not null references users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, other_id)
);
alter table friend_dm_reads enable row level security;
grant all on table friend_dm_reads to anon, authenticated, service_role;
