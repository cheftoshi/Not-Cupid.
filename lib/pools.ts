// Dating-pool segmentation — the single source of truth for which segment
// a user belongs to. Used by the matcher (intent prioritization), the
// rematch cron (cooldown release), and the admin pool dashboard.
//
// A user's segment is COMPUTED from live state, never stored — it depends
// on cooldown timestamps and session recency that change continuously.
//
// Two dimensions for active daters:
//   - intent  (serious / casual / enm / open)  ← from quiz inputs
//   - tier    (A / B / next)                    ← from app engagement
// Plus three non-active states that take priority: banned, cooldown, matched.

export type Intent = 'serious' | 'casual' | 'enm' | 'open';
export type Tier = 'A' | 'B' | 'next';
export type SegmentKind = 'active' | 'cooldown' | 'banned' | 'matched';

export interface Segment {
  kind: SegmentKind;
  intent?: Intent;
  tier?: Tier;
  label: string;            // human label e.g. "serious · A" or "cooldown"
  cooldownUntil?: string | null;
  ghostReports?: number;
}

// Tier thresholds (days since last session).
const TIER_A_DAYS = 2;
const TIER_B_DAYS = 7;

// ─── Intent (from relationship_style, then the 'future' vibe as fallback) ──
export function intentOf(user: any): Intent {
  const style = user?.relationship_style as string | null | undefined;
  if (style === 'enm_poly') return 'enm';
  if (style === 'marriage_track' || style === 'dink') return 'serious';
  if (style === 'casual') return 'casual';
  if (style === 'open') return 'open';

  // No explicit style → infer from the 'future' vibe (1..4, 4 = marriage+kids).
  const future = typeof user?.vibes?.future === 'number' ? user.vibes.future : null;
  if (future != null) {
    if (future >= 3) return 'serious';
    if (future <= 2) return 'casual';
  }
  return 'open';
}

// "Prioritize, don't constrain": are these two intents a PREFERRED pairing?
// open is a wildcard (matches anyone) so thin segments never starve.
export function intentCompatible(a: Intent, b: Intent): boolean {
  if (a === 'open' || b === 'open') return true;
  return a === b;
}

// ─── Engagement tier (from pool_active + session recency) ──────────────────
export function tierOf(user: any, lastSessionAt: Date | null, now: Date): Tier {
  // Not in the active wave → queued for the next release.
  if (!user?.pool_active) return 'next';
  if (!lastSessionAt) return 'B';
  const days = (now.getTime() - lastSessionAt.getTime()) / 86_400_000;
  if (days <= TIER_A_DAYS) return 'A';
  if (days <= TIER_B_DAYS) return 'B';
  return 'next';
}

// ─── Full segment (penalty states win over active) ─────────────────────────
export function computeSegment(user: any, lastSessionAt: Date | null, now: Date): Segment {
  if (user?.matching_disabled_at) {
    return { kind: 'banned', label: 'banned', ghostReports: user.ghost_reports_received ?? 0 };
  }
  if (user?.matching_cooldown_until && new Date(user.matching_cooldown_until) > now) {
    return {
      kind: 'cooldown',
      label: 'cooldown',
      cooldownUntil: user.matching_cooldown_until,
      ghostReports: user.ghost_reports_received ?? 0,
    };
  }
  if (user?.status === 'matched') {
    return { kind: 'matched', label: 'in a match' };
  }
  const intent = intentOf(user);
  const tier = tierOf(user, lastSessionAt, now);
  return { kind: 'active', intent, tier, label: `${intent} · ${tier}` };
}

export const INTENTS: Intent[] = ['serious', 'casual', 'enm', 'open'];
export const TIERS: Tier[] = ['A', 'B', 'next'];

// ─── Gender-balance intake gating ──────────────────────────────────────────
// Keep each metro's ACTIVE pool from skewing so hard that one side piles up
// unmatched. The over-represented gender may hold at most BALANCE_CEILING of
// the active pool; excess new signups go on a soft hold and release as the
// scarce side joins. Tiny pools are exempt so we don't gate a brand-new metro.
export const BALANCE_CEILING = 0.62;          // max active fraction for the over-rep gender
export const BALANCE_MIN_POOL = 8;            // don't gate metros smaller than this
export const MAX_BALANCE_HOLD_DAYS = 3;       // never hold anyone longer than this (anti-churn)

// Given the scarce side's active count, the max over-rep count the ceiling
// allows. e.g. ceiling 0.62 → at most ~1.63 men per woman.
export function maxOverrep(scarceCount: number): number {
  return Math.floor(scarceCount * (BALANCE_CEILING / (1 - BALANCE_CEILING)));
}

// Equity rotation: a small additive bonus (on the 0-100 score scale) for
// candidates who haven't matched recently, so the same high-scorers don't
// monopolize the scarce side. Compatibility still dominates; this only tips
// near-ties toward the under-served.
export function equityBonus(lastMatchedAt: string | null | undefined, nowMs: number): number {
  if (!lastMatchedAt) return 8; // never matched → give them a shot
  const days = (nowMs - new Date(lastMatchedAt).getTime()) / 86_400_000;
  if (days >= 14) return 8;
  if (days >= 3) return 4;
  return 0;
}
