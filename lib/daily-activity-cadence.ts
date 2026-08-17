export const DAILY_ACTIVITY_EMAIL_HOUR_ET = 13;
export const DAILY_ACTIVITY_EMAIL_WINDOW_MINUTES = 15;

function easternParts(now: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now).map((part) => [part.type, part.value]));
}

export function dailyActivityEasternDay(now: Date) {
  const parts = easternParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isDailyActivitySendWindow(now: Date) {
  const parts = easternParts(now);
  return Number(parts.hour) === DAILY_ACTIVITY_EMAIL_HOUR_ET
    && Number(parts.minute) < DAILY_ACTIVITY_EMAIL_WINDOW_MINUTES;
}
