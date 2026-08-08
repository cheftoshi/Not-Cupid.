-- Per-activity RSVP tallies computed IN the database (GROUP BY) instead of
-- fetching every RSVP row into the API and counting in JS. The friend activity
-- board calls this with the ~60 visible activity ids; returns one row each.
create or replace function activity_rsvp_counts(p_ids uuid[])
returns table (activity_id uuid, yes int, maybe int, no int)
language sql
stable
as $$
  select
    activity_id,
    count(*) filter (where coalesce(response, 'yes') = 'yes')::int   as yes,
    count(*) filter (where coalesce(response, 'yes') = 'maybe')::int as maybe,
    count(*) filter (where coalesce(response, 'yes') = 'no')::int    as no
  from friend_activity_rsvps
  where activity_id = any(p_ids)
  group by activity_id
$$;
