-- Pool freshness: gender-balance intake gating + equity rotation.
--
-- balance_hold_at: set when a new over-represented-gender signup is put on a
--   soft "early access" hold in a skewed metro (pool_active=false). The cron
--   releases them as the scarce side joins, or after a 3-day cap. Null = not
--   balance-held. Users never see a "you're held because too many men"
--   message — they just see the normal positive "in the queue" state.
--
-- last_matched_at: when this user was last put into a match. Drives equity
--   rotation — the matcher boosts candidates who haven't matched recently so
--   the same high-scoring people don't monopolize the scarce side.

alter table users add column if not exists balance_hold_at timestamptz;
alter table users add column if not exists last_matched_at timestamptz;

create index if not exists users_balance_hold_idx on users(balance_hold_at) where balance_hold_at is not null;
