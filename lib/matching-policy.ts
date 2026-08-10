// Matching availability + rotation policy shared by the live roster and cron.
//
// A user is "active" when they have used an authenticated session in the last
// 12 days. Active candidates are ranked ahead of dormant fallbacks. A candidate
// shown on a roster gets a seven-day exposure cooldown; the cooldown is soft so
// thin pools can still backfill a complete roster instead of returning nothing.

export const RECENT_USER_DAYS = 3;
export const ACTIVE_USER_DAYS = 12;
export const ROSTER_EXPOSURE_COOLDOWN_DAYS = 7;
export const ROSTER_RETURN_ROTATION_HOURS = 24;
export const LOVE_MAX_CONNECTIONS = 3;
export const LOVE_ROSTER_OPTIONS = 5;

const DAY_MS = 86_400_000;

export function activeUserCutoffIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - ACTIVE_USER_DAYS * DAY_MS).toISOString();
}

export function rosterExposureCutoffIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - ROSTER_EXPOSURE_COOLDOWN_DAYS * DAY_MS).toISOString();
}

export function rosterVerificationCutoffIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - ROSTER_RETURN_ROTATION_HOURS * 60 * 60 * 1000).toISOString();
}

export function isActiveWithinWindow(
  lastUsedAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!lastUsedAt) return false;
  const time = new Date(lastUsedAt).getTime();
  return Number.isFinite(time) && time >= nowMs - ACTIVE_USER_DAYS * DAY_MS;
}

export type MatchingActivitySegment = 'recent' | 'active' | 'dormant';

export function matchingActivitySegment(
  lastUsedAt: string | null | undefined,
  nowMs: number = Date.now(),
): MatchingActivitySegment {
  if (!lastUsedAt) return 'dormant';
  const time = new Date(lastUsedAt).getTime();
  if (!Number.isFinite(time)) return 'dormant';
  const ageMs = nowMs - time;
  if (ageMs <= RECENT_USER_DAYS * DAY_MS) return 'recent';
  if (ageMs <= ACTIVE_USER_DAYS * DAY_MS) return 'active';
  return 'dormant';
}

type RankedWithId = { user: { id: string } };

export function addedRosterCandidateIds(previousIds: string[], currentIds: string[]): string[] {
  if (previousIds.length === 0) return [];
  const previous = new Set(previousIds);
  return currentIds.filter((id) => !previous.has(id));
}

/**
 * Stable, policy-first ordering:
 *   1. recent (0–3d) + not shown during the seven-day cooldown
 *   2. active (4–12d) + not shown
 *   3. recent + recently shown (thin-pool fallback)
 *   4. active + recently shown
 *   5. dormant + not recently shown
 *   6. dormant + recently shown
 *
 * Compatibility order is preserved inside each group.
 */
export function orderForRosterRotation<T extends RankedWithId>(
  ranked: T[],
  activityByCandidateId: ReadonlyMap<string, MatchingActivitySegment>,
  recentlyShownIds: ReadonlySet<string>,
): T[] {
  const priority = (id: string) => {
    const activity = activityByCandidateId.get(id) ?? 'dormant';
    const shown = recentlyShownIds.has(id);
    if (activity === 'recent' && !shown) return 0;
    if (activity === 'active' && !shown) return 1;
    if (activity === 'recent' && shown) return 2;
    if (activity === 'active' && shown) return 3;
    if (!shown) return 4;
    return 5;
  };

  return ranked
    .map((candidate, index) => ({ candidate, index, priority: priority(candidate.user.id) }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ candidate }) => candidate);
}
