-- Friend Line age preference. Symmetric, like friend_seeking: a friend match
-- only happens if each person's age falls in the other's preferred range.
-- NULL = no preference on that bound. Defaults are wide so existing friend
-- users aren't suddenly filtered.
alter table users add column if not exists friend_age_min int;
alter table users add column if not exists friend_age_max int;
