-- Ghost strikes: a PERMANENT, lifetime ghost counter that self-reactivate
-- cannot zero (unlike ghost_reports_received, which it does reset). Drives
-- escalating pauses for repeat ghosters and a hard cap past which only an admin
-- can restore the account. Test accounts are never struck (handled in code).
alter table users add column if not exists ghost_strikes int not null default 0;
