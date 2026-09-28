// Pure, shared event policy. No provider credentials or attendee data in clients.
export type CityEvent = {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
  url: string;
  category: 'music' | 'arts' | 'sports';
  price: { min: number; max: number; currency: string } | null;
};
export type EventWindow = 'today' | 'weekend' | 'week';

export function ticketmasterUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['ticketmaster.com', 'www.ticketmaster.com'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

export function normalizeCityEvent(raw: any, now = Date.now()): CityEvent | null {
  const id = raw?.id;
  const startsAt = raw?.dates?.start?.dateTime;
  const url = ticketmasterUrl(raw?.url);
  const venue = raw?._embedded?.venues?.[0]?.name;
  const category = ({ Music: 'music', 'Arts & Theatre': 'arts', Sports: 'sports' } as const)[raw?.classifications?.[0]?.segment?.name as 'Music'];
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
      typeof raw?.name !== 'string' || !raw.name.trim() || typeof venue !== 'string' ||
      !url || !category || raw?.dates?.status?.code !== 'onsale' ||
      raw?.dates?.start?.dateTBA || raw?.dates?.start?.dateTBD || raw?.dates?.start?.timeTBA || raw?.dates?.start?.noSpecificTime ||
      typeof startsAt !== 'string' || !Number.isFinite(Date.parse(startsAt)) ||
      Date.parse(startsAt) <= now || Date.parse(startsAt) > now + 14 * 86400000) return null;
  const p = raw?.priceRanges?.[0];
  const price = p && Number.isFinite(p.min) && Number.isFinite(p.max) && p.min >= 0 && p.max >= p.min && /^[A-Z]{3}$/.test(p.currency)
    ? { min: p.min, max: p.max, currency: p.currency } : null;
  return { id: `live:tm:${id}`, title: raw.name.slice(0, 200), venue: venue.slice(0, 120), startsAt, url, category, price };
}

const easternDay = (time: number) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(time);

export function eventInWindow(event: CityEvent, window: EventWindow, now = Date.now()) {
  const at = Date.parse(event.startsAt);
  if (!Number.isFinite(at) || at <= now) return false;
  if (window === 'today') return easternDay(at) === easternDay(now);
  if (window === 'week') return at < now + 7 * 86400000;
  // This Friday–Sunday (including today on a weekend), in the city's timezone.
  const day = new Date(easternDay(now) + 'T12:00:00Z').getUTCDay();
  const untilFriday = day === 0 || day >= 5 ? 0 : 5 - day;
  const end = day === 0 ? 0 : 7 - day;
  const nominal = Date.parse(easternDay(now) + 'T12:00:00Z');
  const date = easternDay(at);
  return date >= new Date(nominal + untilFriday * 86400000).toISOString().slice(0, 10) &&
    date <= new Date(nominal + end * 86400000).toISOString().slice(0, 10);
}

export function eventPrice(event: CityEvent) {
  if (!event.price) return 'Check ticket price';
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: event.price.currency, maximumFractionDigits: 0 });
  return event.price.max === 0 ? 'Listed as free · verify availability' : `From ${money.format(event.price.min)} · fees may apply`;
}
