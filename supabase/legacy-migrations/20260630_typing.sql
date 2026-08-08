-- Live "typing…" indicator for the love chat. The client only renders the
-- bubble while the timestamp is fresh (<6s), so stale values need no cleanup.
alter table matches add column if not exists user_1_typing_at timestamptz;
alter table matches add column if not exists user_2_typing_at timestamptz;
