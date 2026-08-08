-- Security hardening migration
-- Run this against your Supabase project before deploying the matching security code.

-- 1. Rate limit table: keyed by an arbitrary string (email, ip, or composite).
--    `count` is incremented on each attempt; `window_start` resets when the window expires.
create table if not exists rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now(),
  blocked_until timestamptz
);

-- 2. Stripe webhook idempotency: prevent replay of valid Stripe events.
create table if not exists stripe_events (
  event_id text primary key,
  type text,
  received_at timestamptz not null default now()
);

-- 3. Index for cleaning up expired OTP codes (optional but useful).
create index if not exists otp_codes_email_created_idx
  on otp_codes (email, created_at desc);
