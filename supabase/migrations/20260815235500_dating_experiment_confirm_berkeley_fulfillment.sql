-- The operator confirmed both Berkeley dinner reservations and confirmed that
-- NotCupid has prepaid the venue directly. This satisfies the operational
-- venue/fulfillment gate only; it does not infer Sponsor identity or legal
-- review and does not open entries.

update public.dating_experiment_event_dates
set status = 'details_confirmed'
where event_key = 'boston-dating-experiment-v1'
  and slot_key in ('aug20-1830', 'aug20-2030')
  and venue_details = 'The Berkeley · 154 Berkeley Street, Boston, MA 02116';

update public.dating_experiment_events
set venue_confirmed = true,
    venue_confirmed_at = now(),
    venue_confirmation_reference = 'Operator attestation on 2026-08-15: both Berkeley dinner reservations confirmed and prepaid for August 20 at 6:30 PM and 8:30 PM ET.',
    prize_fulfillment_method = 'NotCupid prepaid The Berkeley directly for the included dinner. Selected participants are not required to pay or request reimbursement for the included dinner. The prepaid value is capped at $200 per pair, including ordinary tax and gratuity; alcohol, parking, valet charges or tips, transportation, and items outside the prepaid arrangement are excluded.',
    winner_fulfillment_details = 'The Berkeley · 154 Berkeley Street, Boston, MA 02116',
    terms_version = 'boston-v10-2026-08-15',
    status = 'draft',
    updated_at = now()
where event_key = 'boston-dating-experiment-v1';
