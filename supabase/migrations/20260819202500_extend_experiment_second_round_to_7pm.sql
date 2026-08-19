-- Operator-approved live extension: keep the existing second shortlist open
-- through 7 PM ET. This changes no pair, score, response, prize, or entry term;
-- it only gives the already-shortlisted participants one additional hour.
update public.dating_experiment_rounds
set response_deadline = '2026-08-19T23:00:00Z'
where event_key = 'boston-dating-experiment-v1'
  and round_number = 2
  and status = 'collecting'
  and response_deadline = '2026-08-19T22:00:00Z';
