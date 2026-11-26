// Scheduling proposal only: no cron registration, provider calls or activation.
export const FRIDAY_FRIENDS_VERSION = 'friday-friends-once-weekly-v1-2026-11-26';
export const FRIDAY_TIME_ZONE = 'America/New_York';
export function fridayWindow(now = Date.now()) {
  if (!Number.isFinite(now)) throw Error('Invalid time');
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: FRIDAY_TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  const date = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (5 - date.getUTCDay() + 7) % 7);
  const windowFor = () => {
    const day = date.toISOString().slice(0, 10);
    // At noon UTC New York is safely on the same date, including DST boundaries.
    const hour = Number(new Intl.DateTimeFormat('en-US', {timeZone: FRIDAY_TIME_ZONE, hour:'numeric', hourCycle:'h23'}).format(date));
    const start = date.getTime() + (14 - hour) * 3600000;
    return {day, start, end: start + 15 * 60000, prepareStart: start - 45 * 60000};
  };
  let window = windowFor();
  if (now >= window.end) { date.setUTCDate(date.getUTCDate() + 7); window = windowFor(); }
  return {...window, timeZone: FRIDAY_TIME_ZONE, attempts: [window.start, window.start + 5*60000, window.start + 10*60000]};
}
export function fridayPreparationWindow(day: string, now = Date.now()) {
  const window = fridayWindow(now);
  if (day !== window.day || now < window.prepareStart || now >= window.end) throw Error('Fresh Friday preparation window required');
  return window;
}
export function isFridaySendWindow(day: string, now = Date.now()) {
  const window = fridayWindow(now);
  return day === window.day && now >= window.start && now < window.end;
}
export function fridayReadinessPlan(now = Date.now()) {
  return {version: FRIDAY_FRIENDS_VERSION, edition:'weekend', audience:'Existing explicitly opted-in eligible adult Boston Friend email members only',
    window: fridayWindow(now), scheduled:false, sendReady:false, authorizedRecipients:0,
    blockers:['Exact fresh Friday manifest, count and provider permission review', 'Friday claim migration must be reviewed and applied through the release workflow', 'Exact Friday execution credentials and version gate remain disabled', 'Pinned owner eligibility, suppression and separately approved owner-copy delivery must be verified'],
    retryPolicy:'No late catch-up. Claimed or uncertain submissions require reconciliation; a new revision never authorizes a resend.'};
}
