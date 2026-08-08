-- "Dating-friendly" flag for Scene events — the host is open to it being a place
-- where romantic connections can spark too (shown as a 💘 badge). Default false.
alter table friend_activities add column if not exists dating_friendly boolean not null default false;
