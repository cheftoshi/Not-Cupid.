// Live local events via Ticketmaster Discovery API.
//
// To enable: get a free API key at https://developer.ticketmaster.com/
// and set TICKETMASTER_API_KEY in Vercel env vars. Without it, this
// module returns [] and the date-vibes deck falls back to curated-only.
//
// Quality controls (applied here so junk never reaches the user):
//   1. Venue whitelist — only events at known good Boston venues qualify.
//      Match is case-insensitive substring against the venue name so
//      "House of Blues Boston" matches "House of Blues" entry.
//   2. Classification gate — Music, Arts & Theatre, Comedy, Sports only.
//      No Family, Misc, Undefined. Wrestling/monster trucks slip in only
//      if they're at a whitelisted venue AND a kept classification — at
//      which point the admin blacklist handles it.
//   3. Status gate — only 'onsale' events. Auto-drops canceled,
//      postponed, rescheduled, offsale.
//   4. Time window — events 3 to 60 days out. Filters out day-of (no time
//      to plan a date) and too-far-future (uncertain).
//   5. Completeness — must have an image, a venue name, and a title.

import type { Activity, ActivityCategory, Interest } from './activities';

const TM_ENDPOINT = 'https://app.ticketmaster.com/discovery/v2/events.json';
const CACHE_MIN = 60;

// In-memory cache keyed by query. Per-instance only — serverless cold
// starts re-cache, which is fine (at most a few fresh fetches per day).
const cache = new Map<string, { at: number; data: Activity[] }>();

// ─── Trusted venue whitelist ─────────────────────────────────────────────
// Substring match (case-insensitive) — TM venue names like "House of Blues
// Boston" should match "house of blues". Edit freely; venues you want to
// allow at scale should live here, one-offs should go through admin hide.
const TRUSTED_VENUES = [
  // Big arenas / theaters
  'td garden',
  'fenway park',
  'gillette stadium',
  'agganis arena',
  'mgm music hall',
  'boch center',
  'wang theatre',
  'shubert theatre',
  'symphony hall',
  'jordan hall',
  'berklee performance',
  // Mid-size music
  'house of blues',
  'the sinclair',
  'paradise rock club',
  'royale',
  'big night live',
  'roadrunner',
  'brighton music hall',
  'crystal ballroom',
  'cafe 939',
  'city winery',
  'the lilypad',
  'the middle east',
  'wally\'s cafe',
  'the beehive',
  // Comedy
  'wilbur theatre',
  'improv asylum',
  'improvboston',
  'the comedy studio',
  'laugh boston',
  // Film
  'coolidge corner theatre',
  'brattle theatre',
  // Sports (covered above for arenas; teams handled via classification)
];

const KEPT_CLASSIFICATIONS = new Set([
  'Music',
  'Arts & Theatre',
  'Sports',
]);

// Map TM segment → our category/tag tuple.
const SEGMENT_MAP: Record<string, { category: ActivityCategory; tags: Interest[] }> = {
  'Music':          { category: 'cultural',    tags: ['music'] },
  'Arts & Theatre': { category: 'cultural',    tags: ['theater', 'art'] },
  'Sports':         { category: 'adventurous', tags: ['sports'] },
};

const MIN_DAYS_OUT = 3;
const MAX_DAYS_OUT = 60;

interface FetchOpts {
  city?: string;
  radiusMiles?: number;
  size?: number;
}

export async function fetchLiveActivities(opts: FetchOpts = {}): Promise<Activity[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return [];

  const city = opts.city || 'Boston';
  const radius = opts.radiusMiles || 25;
  const size = Math.min(opts.size || 50, 200);

  const cacheKey = `${city}|${radius}|${size}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MIN * 60_000) {
    return cached.data;
  }

  const now = new Date();
  const startWindow = new Date(now.getTime() + MIN_DAYS_OUT * 86400_000);
  const endWindow = new Date(now.getTime() + MAX_DAYS_OUT * 86400_000);

  const url = new URL(TM_ENDPOINT);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('city', city);
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('unit', 'miles');
  url.searchParams.set('size', String(size));
  url.searchParams.set('sort', 'date,asc');
  url.searchParams.set('startDateTime', startWindow.toISOString().slice(0, 19) + 'Z');
  url.searchParams.set('endDateTime', endWindow.toISOString().slice(0, 19) + 'Z');

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
  const title = e?.name as string | undefined;
  if (!id || !title) return null;

  // Status gate — only events still actually purchasable.
  const statusCode = e?.dates?.status?.code as string | undefined;
  if (statusCode && statusCode !== 'onsale') return null;

  // Classification gate.
  const segmentName = e?.classifications?.[0]?.segment?.name as string | undefined;
  if (!segmentName || !KEPT_CLASSIFICATIONS.has(segmentName)) return null;
  const meta = SEGMENT_MAP[segmentName];
  if (!meta) return null;

  // Venue whitelist (only for whitelisted-venue events).
  const venue = e?._embedded?.venues?.[0]?.name as string | undefined;
  if (!venue) return null;
  const venueLower = venue.toLowerCase();
  const matchesTrustedVenue = TRUSTED_VENUES.some((t) => venueLower.includes(t));
  if (!matchesTrustedVenue) return null;

  // Image required.
  const imageUrl = pickImage(e?.images);
  if (!imageUrl) return null;

  const url = e?.url as string | undefined;
  const whenLabel = formatWhen(e?.dates);

  // Tag enrichment from genre/subGenre.
  const tags = new Set<Interest>(meta.tags);
  const genre = e?.classifications?.[0]?.genre?.name as string | undefined;
  const subGenre = e?.classifications?.[0]?.subGenre?.name as string | undefined;
  for (const g of [genre, subGenre]) {
    if (!g) continue;
    const lg = g.toLowerCase();
    if (lg.includes('comedy')) tags.add('comedy');
    if (lg.includes('jazz') || lg.includes('rock') || lg.includes('pop') || lg.includes('hip') || lg.includes('country') || lg.includes('classical')) tags.add('music');
    if (lg.includes('film') || lg.includes('cinema')) tags.add('films');
  }

  return {
    id: `live:tm:${id}`,
    source: 'ticketmaster',
    title,
    blurb: `${segmentName} · ${venue}`,
    category: meta.category,
    tags: Array.from(tags) as Interest[],
    venue,
    url,
    imageUrl,
    whenLabel,
  };
}

function pickImage(images: any[] | undefined): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  const wide = images.find((i: any) => i?.ratio === '16_9' && i?.width >= 640 && i?.width <= 1200);
  return (wide?.url || images[0]?.url) as string | undefined;
}

function formatWhen(dates: any): string | undefined {
  const local = dates?.start?.localDate as string | undefined;
  const localTime = dates?.start?.localTime as string | undefined;
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
