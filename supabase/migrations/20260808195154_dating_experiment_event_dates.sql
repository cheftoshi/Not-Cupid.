-- A single experiment may offer more than one dinner date. Calendar dates can
-- be published before the time and venue are confirmed, but the runtime stays
-- fail-closed until every active date has complete fulfillment details.

create table public.dating_experiment_event_dates (
  event_key text not null
    references public.dating_experiment_events(event_key) on delete cascade,
  event_date date not null,
  public_label text not null check (char_length(public_label) between 6 and 80),
  starts_at timestamptz,
  venue_details text,
  status text not null default 'date_confirmed'
    check (status in ('date_confirmed', 'details_confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_key, event_date),
  check (
    status <> 'details_confirmed'
    or (starts_at is not null and nullif(btrim(venue_details), '') is not null)
  )
);

alter table public.dating_experiment_event_dates enable row level security;
revoke all on table public.dating_experiment_event_dates from anon, authenticated;
grant all on table public.dating_experiment_event_dates to service_role;

insert into public.dating_experiment_event_dates (
  event_key, event_date, public_label, status
) values
  ('boston-dating-experiment-v1', '2026-08-19', 'August 19, 2026', 'date_confirmed'),
  ('boston-dating-experiment-v1', '2026-08-21', 'August 21, 2026', 'date_confirmed');

-- Date language materially changes the entry agreement, so require the next
-- terms version. Remove the premature venue assumption until it is confirmed.
update public.dating_experiment_events
set terms_version = 'boston-v6-2026-08-08',
    winner_fulfillment_details = null,
    updated_at = now()
where event_key = 'boston-dating-experiment-v1'
  and status = 'draft';
