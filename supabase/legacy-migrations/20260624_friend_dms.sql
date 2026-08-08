-- Private 1:1 DMs between connected friends (separate from the pack/crew group chat).
-- A connection = a private message thread; the group circle stays for the pack.
create table if not exists friend_dms (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null,   -- canonical: user_a_id < user_b_id
  user_b_id uuid not null,
  sender_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists friend_dms_pair_idx on friend_dms (user_a_id, user_b_id, created_at);

-- Deny-by-default RLS (service key bypasses; the anon client never queries this).
alter table friend_dms enable row level security;

-- Table privileges — the server (service_role) needs these or every query is
-- "permission denied for table friend_dms". RLS still blocks anon/authenticated.
grant all on table friend_dms to anon, authenticated, service_role;
