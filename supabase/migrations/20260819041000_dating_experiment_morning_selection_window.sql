-- Give the first private shortlist a focused six-hour response window. The
-- application uses fixed August 19 round cutoffs (2 PM and 6 PM ET) and falls
-- back to at least one hour only if an operational delay starts a round late.
update public.dating_experiment_events
set response_hours = 6,
    updated_at = now()
where event_key = 'boston-dating-experiment-v1'
  and status in ('entry_open', 'entry_closed', 'shortlisting');
