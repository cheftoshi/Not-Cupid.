-- Align the operational status with the already-enforced timestamp gate. The
-- draw cron also performs this transition idempotently for future events.
update public.dating_experiment_events
set status = 'entry_closed',
    updated_at = now()
where event_key = 'boston-dating-experiment-v1'
  and status = 'entry_open'
  and entry_closes_at <= now();
