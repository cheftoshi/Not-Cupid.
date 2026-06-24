-- Friend-pack engagement cooldown (6/24). If someone keeps getting packs and
-- never opts in, they go on a 15-day break so they don't clog others' packs.
-- friend_skips = how many opt-in windows they've let lapse (cap 3 → cooldown);
-- friend_pack_seen_at = when we first saw their current un-opted pack (the clock);
-- friend_cooldown_until = the break ends at this time. All friend-line only (does
-- NOT touch the Love line).
alter table users add column if not exists friend_skips int not null default 0;
alter table users add column if not exists friend_pack_seen_at timestamptz;
alter table users add column if not exists friend_cooldown_until timestamptz;
