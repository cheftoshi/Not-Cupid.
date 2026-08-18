-- Durable lifecycle tracking for Love Line decisions and notifications.
-- Additive by design: the currently deployed app can keep serving traffic while
-- this migration lands, and the new app can safely run before/after backfill.

alter table public.matches
  add column if not exists user_1_accepted_at timestamptz,
  add column if not exists user_2_accepted_at timestamptz,
  add column if not exists decision_reminder_sent_at timestamptz;

-- The exact legacy acceptance time is unknowable. `created_at` is an explicit,
-- conservative approximation that prevents already-decided users from looking
-- unresponsive in the new funnel.
update public.matches
set user_1_accepted_at = created_at
where user_1_accepted = true and user_1_accepted_at is null;

update public.matches
set user_2_accepted_at = created_at
where user_2_accepted = true and user_2_accepted_at is null;

create index if not exists matches_pending_decision_reminder_idx
  on public.matches (created_at)
  where status = 'pending'
    and ended_at is null
    and decision_reminder_sent_at is null;

create table if not exists public.love_notification_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'interest_immediate',
    'decision_24h',
    'decision_final',
    'mutual',
    'expired'
  )),
  channel text not null check (channel in ('email', 'push', 'in_app')),
  status text not null default 'claimed' check (status in (
    'claimed', 'sent', 'delivered', 'opened', 'clicked',
    'failed', 'skipped', 'recorded'
  )),
  provider_id text,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  failed_at timestamptz,
  last_event_at timestamptz not null default now(),
  responded_at timestamptz,
  response text check (response is null or response in ('accepted', 'passed', 'expired')),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  unique (match_id, recipient_id, notification_type, channel)
);

create index if not exists love_notification_events_recipient_idx
  on public.love_notification_events (recipient_id, claimed_at desc);
create index if not exists love_notification_events_status_idx
  on public.love_notification_events (notification_type, channel, status, claimed_at desc);
create index if not exists love_notification_events_provider_idx
  on public.love_notification_events (provider_id)
  where provider_id is not null;

alter table public.love_notification_events enable row level security;
revoke all on table public.love_notification_events from anon, authenticated;
grant select, insert, update, delete on table public.love_notification_events to service_role;

create or replace function public.claim_love_notification_event(
  p_match_id uuid,
  p_recipient_id uuid,
  p_notification_type text,
  p_channel text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_notification_type not in ('interest_immediate', 'decision_24h', 'decision_final', 'mutual', 'expired')
    or p_channel not in ('email', 'push', 'in_app') then
    raise exception 'invalid Love notification event';
  end if;

  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and p_recipient_id in (m.user_1_id, m.user_2_id)
  ) then
    raise exception 'recipient is not a match participant';
  end if;

  insert into public.love_notification_events (
    match_id, recipient_id, notification_type, channel
  ) values (
    p_match_id, p_recipient_id, p_notification_type, p_channel
  )
  on conflict (match_id, recipient_id, notification_type, channel) do update
    set status = 'claimed',
        claimed_at = now(),
        sent_at = null,
        delivered_at = null,
        opened_at = null,
        clicked_at = null,
        failed_at = null,
        last_event_at = now(),
        provider_id = null,
        error_code = null
    where love_notification_events.status = 'failed'
      and love_notification_events.claimed_at < now() - interval '30 minutes'
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.claim_love_notification_event(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_love_notification_event(uuid, uuid, text, text) to service_role;

-- Preserve the existence of legacy final reminders without pretending that we
-- know whether the provider delivered or opened them.
insert into public.love_notification_events (
  match_id, recipient_id, notification_type, channel, status,
  claimed_at, sent_at, last_event_at, metadata
)
select
  m.id,
  case when m.user_1_accepted then m.user_2_id else m.user_1_id end,
  'decision_final',
  'email',
  'recorded',
  m.expiring_reminder_sent_at,
  m.expiring_reminder_sent_at,
  m.expiring_reminder_sent_at,
  jsonb_build_object('legacy', true)
from public.matches m
where m.expiring_reminder_sent_at is not null
  and (m.user_1_accepted <> m.user_2_accepted)
on conflict (match_id, recipient_id, notification_type, channel) do nothing;
