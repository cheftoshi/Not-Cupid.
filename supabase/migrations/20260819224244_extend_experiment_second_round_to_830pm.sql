-- Operator-approved live extension: keep the existing second shortlist open
-- through 8:30 PM ET. Public entries stay closed and this changes no pair,
-- score, sealed response, prize, notification, or event term.
update public.dating_experiment_rounds
set response_deadline = '2026-08-20T00:30:00Z'
where event_key = 'boston-dating-experiment-v1'
  and round_number = 2
  and status = 'collecting'
  and response_deadline = '2026-08-19T23:00:00Z';
