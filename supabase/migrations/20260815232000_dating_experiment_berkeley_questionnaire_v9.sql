-- Record the operator's intended venue without claiming the two reservations
-- are booked. The address remains service-only until a mutual winning pair is
-- written to raffle_draws. Also add one-time reminder claims for winners.

alter table public.raffle_draws
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_3h_sent_at timestamptz;

create index if not exists raffle_draws_upcoming_experiment_reminders_idx
  on public.raffle_draws(event_key, happens_at)
  where status = 'both_accepted';

update public.dating_experiment_event_dates
set venue_details = 'The Berkeley · 154 Berkeley Street, Boston, MA 02116'
where event_key = 'boston-dating-experiment-v1'
  and slot_key in ('aug20-1830', 'aug20-2030');

update public.dating_experiment_events
set terms_version = 'boston-v9-2026-08-15',
    algorithm_version = 'dating-experiment-two-pair-v4',
    winner_fulfillment_details = 'The Berkeley · 154 Berkeley Street, Boston, MA 02116',
    -- Venue choice is known, but reservations/payment are not yet evidenced.
    venue_confirmed = false,
    venue_confirmed_at = null,
    venue_confirmation_reference = null,
    prize_fulfillment_method = null,
    status = 'draft',
    updated_at = now()
where event_key = 'boston-dating-experiment-v1';

comment on column public.raffle_draws.reminder_24h_sent_at is
  'Atomic claim for the opted-in winner reminder during the final 24 hours.';
comment on column public.raffle_draws.reminder_3h_sent_at is
  'Atomic claim for the opted-in winner reminder during the final 3 hours.';
