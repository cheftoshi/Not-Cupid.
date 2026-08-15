-- The first public Boston experiment has two reservations on the same calendar
-- date. Give every dinner an event-owned slot key so the two winning pairs can
-- be assigned independently without exposing the restaurant publicly.

alter table public.dating_experiment_event_dates
  add column if not exists slot_key text;

update public.dating_experiment_event_dates
set slot_key = to_char(event_date, 'YYYY-MM-DD')
where slot_key is null;

alter table public.dating_experiment_event_dates
  drop constraint if exists dating_experiment_event_dates_pkey;
alter table public.dating_experiment_event_dates
  alter column slot_key set not null;
alter table public.dating_experiment_event_dates
  add constraint dating_experiment_event_dates_slot_key_check
  check (slot_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slot_key) between 6 and 80);
alter table public.dating_experiment_event_dates
  add constraint dating_experiment_event_dates_pkey primary key (event_key, slot_key);

alter table public.dating_experiment_event_dates
  drop constraint if exists dating_experiment_event_dates_status_check;
alter table public.dating_experiment_event_dates
  add constraint dating_experiment_event_dates_status_check
  check (status in ('date_confirmed', 'time_confirmed', 'details_confirmed', 'cancelled'));

alter table public.dating_experiment_event_dates
  drop constraint if exists dating_experiment_event_dates_check;
alter table public.dating_experiment_event_dates
  add constraint dating_experiment_event_dates_details_check
  check (
    (status not in ('time_confirmed', 'details_confirmed') or starts_at is not null)
    and (status <> 'details_confirmed' or nullif(btrim(venue_details), '') is not null)
  );

delete from public.dating_experiment_event_dates
where event_key = 'boston-dating-experiment-v1';

insert into public.dating_experiment_event_dates (
  event_key, slot_key, event_date, public_label, starts_at, venue_details, status
) values
  (
    'boston-dating-experiment-v1',
    'aug20-1830',
    '2026-08-20',
    'Thursday, August 20 · 6:30 PM ET',
    '2026-08-20T22:30:00Z',
    null,
    'time_confirmed'
  ),
  (
    'boston-dating-experiment-v1',
    'aug20-2030',
    '2026-08-20',
    'Thursday, August 20 · 8:30 PM ET',
    '2026-08-21T00:30:00Z',
    null,
    'time_confirmed'
  );

-- Funding and the public operating window were explicitly confirmed on
-- August 15. The event remains draft and fail-closed until venue fulfillment,
-- Sponsor details, and Massachusetts legal review are separately confirmed.
update public.dating_experiment_events
set terms_version = 'boston-v7-2026-08-15',
    entry_opens_at = '2026-08-15T04:00:00Z',
    entry_closes_at = '2026-08-18T16:00:00Z',
    happens_at = '2026-08-21T00:30:00Z',
    prize_per_pair_cents = 20000,
    winner_pair_limit = 2,
    prize_funding_confirmed = true,
    venue_confirmed = false,
    sponsor_details_confirmed = false,
    legal_review_approved = false,
    winner_fulfillment_details = 'Boston restaurant; exact location shared privately with selected pairs.',
    status = 'draft',
    updated_at = now()
where event_key = 'boston-dating-experiment-v1';

-- Keep slot availability trustworthy even if an internal caller bypasses the
-- HTTP route. Only service-role code can write entries, but the database still
-- rejects empty, duplicate, or unknown dinner slot keys.
create or replace function public.validate_dating_experiment_slot_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_slot_count integer;
  v_distinct_slot_count integer;
begin
  if not exists (
    select 1
    from public.dating_experiment_event_dates
    where event_key = new.event_key and status <> 'cancelled'
  ) then
    return new;
  end if;
  if jsonb_typeof(new.questionnaire -> 'availableSlotKeys') is distinct from 'array' then
    raise exception 'dating experiment dinner availability is required';
  end if;
  select count(*), count(distinct slot.value)
  into v_slot_count, v_distinct_slot_count
  from jsonb_array_elements_text(new.questionnaire -> 'availableSlotKeys') slot(value);
  if v_slot_count < 1 or v_slot_count > 2 or v_slot_count <> v_distinct_slot_count then
    raise exception 'dating experiment dinner availability is invalid';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(new.questionnaire -> 'availableSlotKeys') slot(value)
    where not exists (
      select 1
      from public.dating_experiment_event_dates event_slot
      where event_slot.event_key = new.event_key
        and event_slot.slot_key = slot.value
        and event_slot.status <> 'cancelled'
    )
  ) then
    raise exception 'dating experiment dinner availability contains an unknown slot';
  end if;
  return new;
end;
$function$;

revoke all on function public.validate_dating_experiment_slot_availability()
  from public, anon, authenticated;
grant execute on function public.validate_dating_experiment_slot_availability()
  to service_role;
drop trigger if exists validate_dating_experiment_slot_availability
  on public.raffle_entries;
create trigger validate_dating_experiment_slot_availability
before insert or update of event_key, terms_version, questionnaire
on public.raffle_entries
for each row execute function public.validate_dating_experiment_slot_availability();
