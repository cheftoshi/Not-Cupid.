-- Keep the Boston Dating Experiment open through the end of Tuesday,
-- August 18. America/New_York is on EDT, so midnight starting Wednesday is
-- 2026-08-19 04:00 UTC. The published rules already permit extending the
-- operating window; no eligibility, selection, prize, or consent term changes.

update public.dating_experiment_events
set entry_closes_at = '2026-08-19T04:00:00Z',
    updated_at = now()
where event_key = 'boston-dating-experiment-v1'
  and status = 'entry_open'
  and entry_closes_at < '2026-08-19T04:00:00Z';
