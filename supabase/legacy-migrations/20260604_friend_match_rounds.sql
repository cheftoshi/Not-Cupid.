-- Friend Maxxin v5 — the $0.99 buys ANOTHER ROUND OF MATCHES (not a chat unlock).
-- Group chats are free now. Each paid round bumps a user's match cap by 5.
-- One row per paid round, keyed by the Stripe payment so granting is idempotent
-- whether it lands via the webhook or the success-redirect.
create table if not exists friend_match_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  stripe_payment_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists friend_match_rounds_user_idx on friend_match_rounds (user_id);
