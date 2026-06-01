-- ⚠️ ONE-TIME DATA FIX — run ONCE, do NOT fold into apply-all.sql.
--
-- Ghost amnesty: clears every existing matching pause / ghost penalty so nobody
-- is locked out because of behavior under the OLD auto-assign-one-match model
-- (which wasn't engaging — a "ghost" there often just meant the experience
-- wasn't compelling). Fresh start for everyone; ghosting counts again from here.
--
-- Re-running this later would wipe legitimately-earned penalties, so keep it out
-- of the idempotent schema source-of-truth. Run it by hand in the SQL editor.

update users
set matching_disabled_at   = null,
    matching_cooldown_until = null,
    ghost_reports_received  = 0,
    ghost_strikes           = 0
where matching_disabled_at is not null
   or matching_cooldown_until is not null
   or ghost_reports_received > 0
   or ghost_strikes > 0;
