-- Responsiveness gate. Counts how many times a user was PICKED (a pending match
-- waiting on them, the other side pre-accepted) but let it EXPIRE without ever
-- accepting. Past MAX_IGNORED_PICKS (3, in lib/match-actions) they're benched
-- from everyone's roster — the pool stops funneling picks into a no-show, which
-- protects the people who DO engage. Resets to 0 the moment they accept (or
-- pre-accept by picking) any match.
alter table users add column if not exists ignored_picks int not null default 0;

-- Atomic increment (supabase-js can't do `col = col + 1` without an RPC).
create or replace function bump_ignored_picks(p_id uuid)
returns void
language sql
as $$
  update users set ignored_picks = ignored_picks + 1 where id = p_id;
$$;
