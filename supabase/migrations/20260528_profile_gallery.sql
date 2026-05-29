-- Profile gallery: up to 3 additional photos per user, beyond the single
-- primary photo_url. These are part of the $2.99 unlock — a matched user
-- only sees them after paying. The primary photo stays always-visible.
--
-- Stored as an array of public storage URLs (max 3 enforced in the API).

alter table users add column if not exists gallery text[] not null default '{}';
