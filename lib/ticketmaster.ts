// Live local events via Ticketmaster Discovery API.
//
// Why Ticketmaster: their public Discovery API has a generous free tier
// (5000 req/day) and good coverage of music, sports, theater, comedy,
// family — exactly the categories we need. Eventbrite shut their search
// API to the public years ago; SeatGeek is similar but smaller catalog.
//
// To enable: get a free API key at https://developer.ticketmaster.com/
// and set TICKETMASTER_API_KEY in Vercel env vars. If unset, this module
// returns [] and the date-vibes deck falls back to curated-only — the
// rest of the feature still works fine.
//
// Caching: the deck route can be hit many times per session. We cache the
// fetched events in module memory keyed by (lat/lng/radius/segment) for
// CACHE_MIN minutes. Serverless cold starts re-cache, which is fine — at
// most a few fresh fetches per day per region.

import type { Activity, ActivityCategory, Interest } from './activities';

const TM_ENDPOINT = 'https://app.ticketmaster.com/discovery/v2/events.json';
const CACHE_MIN = 60;

const cache = new Map<string, { at: number; data: Activity[] }>();

// Map Ticketmaster's broad classification (segment) names → our
// (category, tags) tuple. Activities not in this map are skipped.
const SEGMENT_MAP: Record<string, { category: ActivityCategory; tags: Interest[] }> = {
  Music:       { category: 'cultural',    tags: ['music'] },
  Sports:      { category: 'adventurous', tags: ['sports'] },
  'Arts & Theatre': { category: 'cultural', tags: ['theater', 'art'] },
  Film:        { category: 'cozy',        tags: ['films'] },
  Miscellaneous: { category: 'cultural',  tags: [] },
};

interface FetchOpts {
  city?: string;        // default 'Boston'
  radiusMiles?: number; // default 25
  size?: number;        // default 30
}

export async function fetchLiveActivities(opts: FetchOpts = {}): Promise<Activity[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return [];

  const city = opts.city || 'Boston';
  const radius = opts.radiusMiles || 25;
  const size = Math.min(opts.size || 30, 50);

  const cacheKey = `${city}|${radius}|${size}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MIN * 60_000) {
    return cached.data;
  }

  const url = new URL(TM_ENDPOINT);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('city', city);
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('unit', 'miles');
  url.searchParams.set('size', String(size));
  url.searchParams.set('sort', 'date,asc');
  // Only events in the next 60 days (anything further is hard to plan a date around)
  const end = new Date();
  end.setDate(end.getDate() + 60);
  url.searchParams.set('endDateTime', end.toISOString().slice(0, 19) + 'Z');

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      console.warn('Ticketmaster: non-200', { status: res.status });
      return [];
    }
    const json: any = await res.json();
    const events: any[] = json?._embedded?.events || [];

    const mapped: Activity[] = events
      .map((e) => toActivity(e))
      .filter((a): a is Activity => a !== null);

    cache.set(cacheKey, { at: Date.now(), data: mapped });
    return mapped;
  } catch (err: any) {
    console.warn('Ticketmaster: fetch failed', { msg: err?.message });
    return [];
  }
}

function toActivity(e: any): Activity | null {
  const id = e?.id;
  if (!id) return null;

  const segmentName = e?.classifications?.[0]?.segment?.name as string | undefined;
  const meta = segmentName ? SEGMENT_MAP[segmentName] : undefined;
  if (!meta) return null;

  const title = e?.name as string | undefined;
  if (!title) return null;

  const venue = e?._embedded?.venues?.[0]?.name as string | undefined;
  const url = e?.url as string | undefined;
  const img = pickImage(e?.images);
  const whenLabel = formatWhen(e?.dates);

  // Tags: combine the segment-derived tags with any genre/sub-genre Ticketmaster
  // provides (e.g. comedy as a music sub-genre), mapped to our Interest vocab.
  const tags = new Set<Interest>(meta.tags);
  const genre = e?.classifications?.[0]?.genre?.name as string | undefined;
  if (genre) {
    const lg = genre.toLowerCase();
    if (lg.includes('comedy')) tags.add('comedy');
    if (lg.includes('jazz') || lg.includes('rock') || lg.includes('pop') || lg.includes('hip')) tags.add('music');
  }

  return {
    id: `live:tm:${id}`,
    source: 'ticketmaster',
    title,
    blurb: venue ? `${segmentName} · ${venue}` : segmentName!,
    category: meta.category,
    tags: Array.from(tags) as Interest[],
    venue,
    url,
    imageUrl: img,
    whenLabel,
  };
}

function pickImage(images: any[] | undefined): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  // Prefer a 16:9 medium-sized image; fallback to first.
  const wide = images.find((i: any) => i?.ratio === '16_9' && i?.width >= 640 && i?.width <= 1200);
  return (wide?.url || images[0]?.url) as string | undefined;
}

function formatWhen(dates: any): string | undefined {
  const local = dates?.start?.localDate as string | undefined; // 'YYYY-MM-DD'
  const localTime = dates?.start?.localTime as string | undefined; // 'HH:MM:SS'
  if (!local) return undefined;
  const [y, m, d] = local.split('-').map(Number);
  if (!y || !m || !d) return local;
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const monthStr = date.toLocaleDateString('en-US', { month: 'short' });
  const time = localTime ? formatTime(localTime) : null;
  return time ? `${weekday} ${monthStr} ${d} · ${time}` : `${weekday} ${monthStr} ${d}`;
}

function formatTime(localTime: string): string {
  const [hh, mm] = localTime.split(':').map(Number);
  if (hh == null) return localTime;
  const h12 = hh % 12 || 12;
  const ampm = hh < 12 ? 'am' : 'pm';
  return mm ? `${h12}:${String(mm).padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
}
