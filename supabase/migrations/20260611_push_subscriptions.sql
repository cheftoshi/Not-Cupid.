-- Web-push subscriptions (PWA notifications). One row per browser/device.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on push_subscriptions(user_id);
-- Deny-by-default RLS like every sensitive table (service key bypasses).
alter table push_subscriptions enable row level security;
