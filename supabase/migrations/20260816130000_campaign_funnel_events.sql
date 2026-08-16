-- User-bound, first-party conversion measurement for approved campaigns.
-- The browser never reads this table; service-role routes write aggregate-safe
-- milestones and the admin dashboard reports unique users at each stage.
create table if not exists public.campaign_funnel_events (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null check (campaign_key ~ '^[a-z0-9_]{1,80}$'),
  user_id uuid not null references public.users(id) on delete cascade,
  variant text not null check (variant in ('ready','profile','love_setup','live')),
  event text not null check (event in (
    'email_clicked','profile_started','profile_saved','profile_eligible','experiment_viewed','entry_submitted'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (campaign_key, user_id, event)
);

create index if not exists campaign_funnel_events_campaign_idx
  on public.campaign_funnel_events (campaign_key, event, created_at desc);
create index if not exists campaign_funnel_events_user_idx
  on public.campaign_funnel_events (user_id, created_at desc);

alter table public.campaign_funnel_events enable row level security;
revoke all on table public.campaign_funnel_events from public, anon, authenticated;
grant all on table public.campaign_funnel_events to service_role;

-- Preserve the campaign clicks that happened before this event ledger existed.
insert into public.campaign_funnel_events (campaign_key, user_id, variant, event, metadata, created_at)
select campaign_key, user_id, variant, 'email_clicked', '{"source":"delivery-ledger-backfill"}'::jsonb, clicked_at
from public.email_campaign_deliveries
where campaign_key = 'dating_experiment_comeback_aug_2026'
  and clicked_at is not null
on conflict (campaign_key, user_id, event) do nothing;

-- Everyone in the profile variant was missing at least one required basic when
-- the email was generated. If they are ready now, their profile converted after
-- send; backfill that milestone without inventing intermediate save attempts.
insert into public.campaign_funnel_events (campaign_key, user_id, variant, event, metadata)
select d.campaign_key, d.user_id, d.variant, 'profile_eligible', '{"source":"current-readiness-backfill"}'::jsonb
from public.email_campaign_deliveries d
join public.users u on u.id = d.user_id
where d.campaign_key = 'dating_experiment_comeback_aug_2026'
  and d.variant = 'profile'
  and d.clicked_at is not null
  and u.photo_url is not null
  and length(trim(coalesce(u.bio, ''))) > 0
  and u.archetype is not null
  and u.score_honesty is not null
  and u.age >= 21
  and (
    coalesce(cardinality(u.hobbies), 0)
    + coalesce(cardinality(u.music), 0)
    + coalesce(cardinality(u.food), 0)
    + coalesce(cardinality(u.sports), 0)
  ) >= 3
on conflict (campaign_key, user_id, event) do nothing;
