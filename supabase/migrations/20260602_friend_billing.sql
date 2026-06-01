-- Friend Maxxin billing v2: per-crew $0.99 chat unlocks + $2.99/mo Pro subscription.
-- Replaces the one-time "founding" model (friend_paid_at kept for back-compat:
-- anyone who already paid founding is grandfathered into Pro-equivalent access).

-- Pro subscription window. Renewals push this forward; cancel lets it lapse.
alter table users add column if not exists friend_pro_until timestamptz;
alter table users add column if not exists stripe_customer_id text;
alter table users add column if not exists friend_sub_id text;          -- active subscription id (null when canceled)

-- One row per (user, circle) the user has paid $0.99 to unlock the chat for.
create table if not exists friend_chat_unlocks (
  user_id uuid not null references users(id) on delete cascade,
  circle_id uuid not null references friend_circles(id) on delete cascade,
  stripe_payment_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, circle_id)
);
create index if not exists friend_chat_unlocks_user_idx on friend_chat_unlocks(user_id);
grant all on friend_chat_unlocks to service_role;
alter table friend_chat_unlocks enable row level security;
