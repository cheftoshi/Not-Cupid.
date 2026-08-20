-- The operator expanded the selected pair's prepaid dinner benefit after the
-- round resolved. This is a participant-favorable fulfillment change: food,
-- alcoholic or non-alcoholic drinks, ordinary tax, and gratuity may all count
-- toward the same $200 pair cap. The cap and winner selection do not change.

update public.dating_experiment_events
set prize_fulfillment_method = 'NotCupid prepaid The Berkeley directly for the included dinner. Selected participants are not required to pay or request reimbursement for the included dinner. Food, alcoholic or non-alcoholic drinks, ordinary tax, and gratuity may all count toward the same $200 per-pair cap. Selected participants are responsible for any amount above $200, plus transportation, parking, or valet charges.',
    updated_at = now()
where event_key = 'boston-dating-experiment-v1';
