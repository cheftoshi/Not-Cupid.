-- Prepared locally only. Production application requires reviewed catalogue
-- deployment and separate migration authorization. Preserve existing references.
alter table public.friend_activities drop constraint friend_event_reference_valid;
alter table public.friend_activities add constraint friend_event_reference_valid
check ((external_event_id is null and external_event_url is null) or
  (external_event_id is not null and external_event_url is not null and kind = 'event' and
    ((external_event_id ~ '^live:tm:[A-Za-z0-9_-]{1,100}$'
      and external_event_url ~ '^https://(www\.)?ticketmaster\.com/') or
     (external_event_id ~ '^live:curated:[a-z0-9][a-z0-9_-]{0,79}$'
      and length(external_event_url) <= 2000
      and external_event_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}(/[^[:space:]]*)?$'))));
-- Existing author/event unique index, RLS, grants and participant privacy remain.
-- The API must revalidate the ID against the current reviewed catalogue and
-- ignore browser-supplied links; SQL shape checks do not establish provenance.
