-- First-party campaign ledger for idempotent sends and admin engagement stats.
-- The service-role-only table never exposes recipient or provider identifiers
-- to browser clients. One row per user/campaign makes retries safe.
create table if not exists public.email_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null check (campaign_key ~ '^[a-z0-9_]{1,80}$'),
  user_id uuid not null references public.users(id) on delete cascade,
  variant text not null default 'ready' check (variant in ('ready','profile','love_setup','live')),
  resend_email_id text,
  status text not null default 'queued' check (status in (
    'queued','sent','delivered','opened','clicked','delayed','suppressed','failed','bounced','complained'
  )),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_key, user_id)
);

create unique index if not exists email_campaign_deliveries_resend_id_uq
  on public.email_campaign_deliveries (resend_email_id)
  where resend_email_id is not null;
create index if not exists email_campaign_deliveries_campaign_idx
  on public.email_campaign_deliveries (campaign_key, created_at desc);
create index if not exists email_campaign_deliveries_user_idx
  on public.email_campaign_deliveries (user_id, created_at desc);

alter table public.email_campaign_deliveries enable row level security;
revoke all on table public.email_campaign_deliveries from public, anon, authenticated;
grant all on table public.email_campaign_deliveries to service_role;
