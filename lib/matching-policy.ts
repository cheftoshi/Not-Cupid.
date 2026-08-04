// Matching availability + rotation policy shared by the live roster and cron.
//
// A user is "active" when they have used an authenticated session in the last
// 12 days. Active candidates are ranked ahead of dormant fallbacks. A candidate
// shown on a roster gets a seven-day exposure cooldown; the cooldown is soft so
// thin pools can still backfill a complete roster instead of returning nothing.

export const ACTIVE_USER_DAYS = 12;
export const ROSTER_EXPOSURE_COOLDOWN_DAYS = 7;
export const LOVE_ROTATION_HOUR_UTC = 16;

const DAY_MS = 86_400_000;

export function activeUserCutoffIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - ACTIVE_USER_DAYS * DAY_MS).toISOString();
}

export function rosterExposureCutoffIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - ROSTER_EXPOSURE_COOLDOWN_DAYS * DAY_MS).toISOString();
}

export function isActiveWithinWindow(
  lastUsedAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!lastUsedAt) return false;
  const time = new Date(lastUsedAt).getTime();
  return Number.isFinite(time) && time >= nowMs - ACTIVE_USER_DAYS * DAY_MS;
}

type RankedWithId = { user: { id: string } };

/**
 * Stable, policy-first ordering:
 *   1. active + not shown during the seven-day cooldown
 *   2. active + recently shown (thin-pool fallback)
 *   3. dormant + not recently shown
 *   4. dormant + recently shown
 *
 * Compatibility order is preserved inside each group.
 */
export function orderForRosterRotation<T extends RankedWithId>(
  ranked: T[],
  activeCandidateIds: ReadonlySet<string>,
  recentlyShownIds: ReadonlySet<string>,
): T[] {
  const priority = (id: string) => {
    const active = activeCandidateIds.has(id);
    const shown = recentlyShownIds.has(id);
    if (active && !shown) return 0;
    if (active && shown) return 1;
    if (!active && !shown) return 2;
    return 3;
  };

  return ranked
    .map((candidate, index) => ({ candidate, index, priority: priority(candidate.user.id) }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ candidate }) => candidate);
}
