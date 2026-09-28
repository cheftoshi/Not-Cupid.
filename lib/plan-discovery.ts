// All currently supported metros use Eastern time. Expand this mapping before
// adding a city in another timezone; never use the server or viewer timezone.
export const PLAN_TIMEZONE = 'America/New_York';
export function planLocalTime(value: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw Error('Choose a valid date and time.');
  const nominal = Date.parse(value + ':00Z');
  const matches: Date[] = [];
  const format = new Intl.DateTimeFormat('sv-SE', { timeZone: PLAN_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  for (const offset of [4, 5]) {
    const candidate = new Date(nominal + offset * 3600000);
    if (Number.isFinite(+candidate) && format.format(candidate).replace(' ', 'T') === value) matches.push(candidate);
  }
  if (matches.length !== 1) throw Error('That time falls in a daylight-saving change. Choose another time.');
  return matches[0];
}
export function planWhen(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Flexible · decide together';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PLAN_TIMEZONE, weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value));
}
export function planTimeMatches(value: string | null | undefined, filter: string, now = Date.now()) {
  if (filter === 'all') return true;
  if (!value) return filter === 'flexible';
  if (filter === 'flexible') return false;
  const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: PLAN_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  if (filter === 'today') return day(new Date(value)) === day(new Date(now));
  return Date.parse(value) >= now && Date.parse(value) < now + 7 * 86400000;
}
export function validateSocialPlan(happensAt: Date | null, rawCapacity: unknown, now = Date.now()) {
  if (happensAt && (!Number.isFinite(+happensAt) || +happensAt <= now || +happensAt > now + 60 * 86400000))
    throw Error('Choose a time within the next 60 days, or leave it flexible.');
  const capacity = rawCapacity == null || rawCapacity === '' ? 4 : Number(rawCapacity);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 10)
    throw Error('Choose 2–10 people, including yourself.');
  return capacity;
}
export function planReturnPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Acquisition links never accept arbitrary URLs or unrelated privileged routes.
  return /^\/hub\?(?:plan|date)=[0-9a-f-]{36}$/i.test(value) || /^\/hub\?city=[a-z_]{2,30}$/.test(value) ? value : null;
}
