-- Keep the paid distribution arrangement in the private operating record.
-- It does not need to appear in NotCupid's participant FAQ or Official Rules.
-- The paid publisher remains responsible for a clear disclosure on its post.

update public.dating_experiment_events
set terms_version = 'boston-v11-2026-08-15',
    status = 'draft',
    updated_at = now()
where event_key = 'boston-dating-experiment-v1';
