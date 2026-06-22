-- Friendship packs (6/21). A "pack" is a batch of friend matches you OPEN
-- cinematically (like a booster pack). opened_at = when the user revealed this
-- connection; NULL = still sealed inside an un-opened pack.
alter table friend_connections add column if not exists opened_at timestamptz;

-- Existing connections are already known to live users — mark them opened so we
-- don't re-seal active crews into a "new pack." New matches arrive unopened.
update friend_connections set opened_at = now() where opened_at is null;

-- NOTE: the $3.99/mo All-Access subscription reuses the existing
-- users.friend_pro_until / friend_sub_id columns (app-wide now, not friend-only)
-- + the existing stripe-webhook friend_pro handlers — no new columns needed.
