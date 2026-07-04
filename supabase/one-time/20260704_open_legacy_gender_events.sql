-- ONE-TIME (run once in the Supabase SQL editor; NOT in apply-all — never re-run
-- ceremonially, though it is idempotent in effect).
--
-- Opens LEGACY cross-gender-targeted events: since 6/27 the server only lets a
-- host restrict an event to a group they're PART OF, but events created before
-- that could target any gender (the red-flag pattern: e.g. a man's "women only"
-- movie night). This clears the gender audience on any event whose author isn't
-- in it — they become open-to-everyone, matching the current model.
update friend_activities a
set audience_gender = null
from users u
where a.author_id = u.id
  and a.audience_gender is not null
  and array_length(a.audience_gender, 1) > 0
  and not (u.gender = any(a.audience_gender))
  and not (coalesce(u.is_lgbtq, false) and 'lgbtq' = any(a.audience_gender));
