-- Privacy-minimal campaign attribution. Values are allowlist-sanitized by the
-- application; raw URLs, query strings, user agents and device identifiers are
-- never stored. Page views support anonymous campaign lift, while signup and
-- event-entry snapshots support aggregate conversion reporting.

alter table public.page_views
  add column if not exists acquisition_source text,
  add column if not exists acquisition_medium text,
  add column if not exists acquisition_campaign text,
  add column if not exists acquisition_kind text check (acquisition_kind in ('utm','referrer')),
  add column if not exists acquisition_landing_path text,
  add column if not exists acquisition_captured_at timestamptz;

alter table public.users
  add column if not exists acquisition_source text,
  add column if not exists acquisition_medium text,
  add column if not exists acquisition_campaign text,
  add column if not exists acquisition_kind text check (acquisition_kind in ('utm','referrer')),
  add column if not exists acquisition_landing_path text,
  add column if not exists acquisition_captured_at timestamptz;

alter table public.raffle_entries
  add column if not exists acquisition_source text,
  add column if not exists acquisition_medium text,
  add column if not exists acquisition_campaign text,
  add column if not exists acquisition_kind text check (acquisition_kind in ('utm','referrer')),
  add column if not exists acquisition_landing_path text,
  add column if not exists acquisition_captured_at timestamptz;

create index if not exists page_views_acquisition_campaign_created_idx
  on public.page_views (acquisition_campaign, created_at desc);
create index if not exists users_acquisition_campaign_created_idx
  on public.users (acquisition_campaign, created_at desc);
create index if not exists raffle_entries_acquisition_campaign_created_idx
  on public.raffle_entries (acquisition_campaign, created_at desc);
