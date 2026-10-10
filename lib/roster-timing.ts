// Only bounded phase durations leave the browser; never SQL, IDs, or headers.
export const ROSTER_PHASES = ['auth', 'compose', 'total', 'cleanup_features', 'pool_history_access', 'operational_inputs', 'ranking', 'snapshot_exposures', 'entitlements_shadow'] as const;
export function parseRosterTiming(header: string | null): Record<string, number> {
  const result: Record<string, number> = {};
  for (const part of (header || '').split(',')) {
    const match = part.trim().match(/^([a-z_]+);dur=(\d+(?:\.\d+)?)$/);
    if (!match || !(ROSTER_PHASES as readonly string[]).includes(match[1])) continue;
    const ms = Number(match[2]);
    if (Number.isFinite(ms) && ms <= 600000) result[match[1]] = ms;
  }
  return result;
}
