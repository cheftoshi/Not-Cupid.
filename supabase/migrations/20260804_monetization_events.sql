-- First-party paywall funnel. Aggregate-only product analytics: no email, name,
-- card details, checkout URLs, or Stripe secrets are stored here.

create table if not exists public.monetization_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  event text not null check (event in ('paywall_viewed', 'checkout_started', 'checkout_failed', 'purchase_completed')),
  product text not null check (product in ('love_profile', 'friend_pack', 'pro')),
  surface text not null check (char_length(surface) between 1 and 80),
  match_id uuid references public.matches(id) on delete set null,
  amount_cents integer check (amount_cents is null or amount_cents between 0 and 100000),
  external_event_id text unique check (external_event_id is null or char_length(external_event_id) between 1 and 255),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists monetization_events_created_idx
  on public.monetization_events (created_at desc);
create index if not exists monetization_events_product_event_idx
  on public.monetization_events (product, event, created_at desc);
create index if not exists monetization_events_user_idx
  on public.monetization_events (user_id, created_at desc);

alter table public.monetization_events enable row level security;
revoke all on table public.monetization_events from public, anon, authenticated;
grant all on table public.monetization_events to service_role;
