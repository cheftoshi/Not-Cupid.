-- Make overlapping scheduler attempts and manual invocations unable to send
-- more than one daily activity email to the same user on the same New York
-- calendar day. Failed provider attempts delete their claim so a later tick in
-- the approved 1:00-1:14 PM window can retry safely.

alter table public.activity_digest_deliveries
  add column if not exists delivery_day date;

update public.activity_digest_deliveries
set delivery_day = (coalesce(sent_at, created_at) at time zone 'America/New_York')::date
where delivery_day is null;

alter table public.activity_digest_deliveries
  alter column delivery_day set not null;

create unique index if not exists activity_digest_deliveries_user_day_uq
  on public.activity_digest_deliveries (user_id, delivery_day);

comment on column public.activity_digest_deliveries.delivery_day is
  'America/New_York calendar day claimed for at-most-once daily delivery.';
