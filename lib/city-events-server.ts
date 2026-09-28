import 'server-only';
import { METRO_CENTERS } from '@/lib/quiz-data';
import { normalizeCityEvent, type CityEvent } from '@/lib/city-events';
import { supabaseAdmin } from '@/lib/supabase';

type Result = { events: CityEvent[]; status: 'ready' | 'unavailable' | 'not_configured' | 'credentials_rejected'; fetchedAt: string };
// Only public event metadata is cached. Safety/blacklist checks are never cached.
const cache = new Map<string, { until: number; result: Result }>();
const pending = new Map<string, Promise<Result>>();

async function fetchCatalog(metro: string, fresh: boolean): Promise<Result> {
  const empty = (status: Result['status']): Result => ({ events: [], status, fetchedAt: new Date().toISOString() });
  const center = METRO_CENTERS[metro];
  if (!center) return empty('unavailable');
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return empty('not_configured');
  const saved = cache.get(metro);
  if (!fresh && saved && saved.until > Date.now()) return saved.result;
  if (!fresh && pending.has(metro)) return pending.get(metro)!;
  const request = async () => {
    const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
    const now = Date.now();
    const params = { apikey: key, latlong: `${center.lat},${center.lng}`, radius: '25', unit: 'miles', countryCode: 'US',
      size: '100', sort: 'date,asc', startDateTime: new Date(now).toISOString().slice(0, 19) + 'Z',
      endDateTime: new Date(now + 14 * 86400000).toISOString().slice(0, 19) + 'Z' };
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
      if (!response.ok) return empty(response.status === 401 || response.status === 403 ? 'credentials_rejected' : 'unavailable');
      const data = await response.json();
      const raw = data?._embedded?.events || [];
      if (!Array.isArray(raw)) return empty('unavailable');
      const events = raw.map(e => normalizeCityEvent(e, now)).filter((e): e is CityEvent => !!e);
      const result: Result = { events: [...new Map(events.map(e => [e.id, e])).values()], status: 'ready', fetchedAt: new Date().toISOString() };
      cache.set(metro, { until: now + 5 * 60000, result });
      return result;
    } catch { return empty('unavailable'); } // Never log a credential-bearing URL.
  };
  const promise = request();
  if (!fresh) pending.set(metro, promise);
  try { return await promise; } finally { if (!fresh) pending.delete(metro); }
}

export async function cityEvents(metro: string, fresh = false): Promise<Result> {
  const result = await fetchCatalog(metro, fresh);
  if (result.status !== 'ready') return result;
  try {
    const blocked = await supabaseAdmin.from('live_activity_blacklist').select('activity_id');
    if (blocked.error) return { ...result, events: [], status: 'unavailable' };
    const ids = new Set((blocked.data || []).map(r => r.activity_id));
    return { ...result, events: result.events.filter(e => !ids.has(e.id) && Date.parse(e.startsAt) > Date.now()) };
  } catch { return { ...result, events: [], status: 'unavailable' }; }
}
