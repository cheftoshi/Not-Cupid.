-- Sports & fitness interests (6/22) — a new "what you're into" category alongside
-- music / food / hobbies, shown as its own colored bubble cluster on the hub.
alter table users add column if not exists sports text[] not null default '{}'::text[];
