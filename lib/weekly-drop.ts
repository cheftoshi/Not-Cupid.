// ── THE WEEKLY DROP — the Friend Line's ritual ──────────────────────────────
// Every Thursday evening, a fresh sealed pack of curated people lands for every
// friend-opted-in user (cron: /api/cron/weekly-drop). The cadence is the
// product: you don't "check the app", you open Thursday's pack — drop culture,
// not feed culture. Extra packs stay paid ($1.99 / free with All-Access) as
// "can't wait till thursday?".
//
// 23:00 UTC ≈ 7pm ET (6pm during winter time) — labeled "thursday evenings" so
// we never promise a precise clock time.

export const DROP = {
  utcDay: 4, // Thursday
  utcHour: 23,
  label: 'thursday evenings',
} as const;

// The most recent drop moment at-or-before `from`.
export function lastDropAt(from = new Date()): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), DROP.utcHour, 0, 0));
  let diff = d.getUTCDay() - DROP.utcDay;
  if (diff < 0) diff += 7;
  d.setUTCDate(d.getUTCDate() - diff);
  if (d.getTime() > from.getTime()) d.setUTCDate(d.getUTCDate() - 7);
  return d;
}

export function nextDropAt(from = new Date()): Date {
  const next = new Date(lastDropAt(from));
  next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

// Stable per-week key (the drop's date) — used for idempotent weekly grants.
export function dropKey(from = new Date()): string {
  return lastDropAt(from).toISOString().slice(0, 10);
}

// "2d 14h" / "3h 12m" until the next drop.
export function untilNextDrop(from = new Date()): string {
  const ms = Math.max(0, nextDropAt(from).getTime() - from.getTime());
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
