-- Add a single-select "relationship style" field so users can self-identify as
-- DINK, ENM/poly, marriage-track, casual, etc. Separate from the existing
-- "future" vibe (which is a seriousness-of-intent scale) — this captures the
-- shape of the relationship someone wants, not the timeline.
--
-- Nullable so existing users don't need a backfill; the quiz and profile form
-- both prompt for it going forward.

alter table users add column if not exists relationship_style text;

-- Constrain to known values. Easy to extend later by altering the check.
alter table users drop constraint if exists users_relationship_style_check;
alter table users add constraint users_relationship_style_check
  check (
    relationship_style is null
    or relationship_style in ('marriage_track', 'dink', 'enm_poly', 'casual', 'open')
  );

create index if not exists users_relationship_style_idx on users(relationship_style);
