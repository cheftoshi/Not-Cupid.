// Ghost-penalty escalation, shared across the report (matches/[id]/end),
// reactivate, both roster routes, and admin lift.
//
// Two counters live on the user row:
//   • ghost_reports_received — soft, current-cycle count. reactivate ZEROS it.
//   • ghost_strikes          — PERMANENT lifetime count. reactivate can't touch
//                              it; only an admin lift (or never) resets it.
//
// Escalation by lifetime strikes:
//   1–2  → a 7-day cooldown (auto-clears, gentle)
//   3–4  → full pause on both lines; the user can self-reactivate (free)
//   ≥5   → full pause; self-reactivate is BLOCKED — admin restore only
//
// Test accounts (users.is_test) are exempt from all of this — they're for QA.

export const GHOST_COOLDOWN_DAYS = 7;
export const GHOST_PAUSE_AT = 3;   // lifetime strikes that trigger a (reactivatable) pause
export const GHOST_HARD_CAP = 5;   // strikes past which only an admin can restore the account
export const GHOST_SUPPORT_EMAIL = 'match@notcupid.com';

// True once a user is beyond the hard cap — self-reactivate is off the table.
export function isHardLocked(strikes: number | null | undefined): boolean {
  return (strikes ?? 0) >= GHOST_HARD_CAP;
}
