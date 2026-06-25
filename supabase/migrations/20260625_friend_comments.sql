-- Comments on Scene posts (talk posts, not events). A post becomes a little thread.
create table if not exists friend_activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references friend_activities(id) on delete cascade,
  user_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists friend_activity_comments_act_idx on friend_activity_comments (activity_id, created_at);

-- Deny-by-default RLS + table grants (service_role needs the grant or every query
-- is "permission denied for table friend_activity_comments"; RLS blocks anon/auth).
alter table friend_activity_comments enable row level security;
grant all on table friend_activity_comments to anon, authenticated, service_role;
