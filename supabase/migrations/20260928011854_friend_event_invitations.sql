-- Member-authored invitations may reference an outside event. They are not
-- imported attendees, tickets, or automatic posts. Existing plans are unchanged.
alter table public.friend_activities
  add column external_event_id text,
  add column external_event_url text;

alter table public.friend_activities add constraint friend_event_reference_valid
  check ((external_event_id is null and external_event_url is null) or
    (external_event_id is not null and external_event_url is not null
     and kind = 'event' and external_event_id ~ '^live:tm:[A-Za-z0-9_-]{1,100}$'
     and external_event_url ~ '^https://(www\.)?ticketmaster\.com/'));

-- Retry and two-tab protection, independently of client-generated request IDs.
create unique index friend_event_host_unique on public.friend_activities
  (author_id, external_event_id) where external_event_id is not null;

-- Aggregate run outcomes only; no message content, emails or provider secrets.
create table public.activity_digest_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null check (status in ('disabled','address_missing','outside_window','empty','completed','partial_failure','error')),
  candidates integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  skipped_claimed integer not null default 0
);
alter table public.activity_digest_runs enable row level security;
revoke all on public.activity_digest_runs from public, anon, authenticated;
grant all on public.activity_digest_runs to service_role;
create index activity_digest_runs_recent on public.activity_digest_runs(created_at desc);
