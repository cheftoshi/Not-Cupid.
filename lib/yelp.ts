// Yelp Fusion → trending Boston restaurants & bars as "go try this" cards.
//
// Important context: Yelp deprecated the Events Search API years ago.
// What's available now is Businesses Search. So this isn't an event feed
// — it's a "places worth going right now" feed, surfaced as activities
// like "Try Sarma — Mediterranean tapas in Somerville, 4.6★".
//
// To enable: get an API key at https://www.yelp.com/developers/v3/manage_app
// and set YELP_API_KEY in Vercel env vars. Without it, returns [].
//
// Quality controls:
//   - rating >= 4.0 (no mediocre spots)
//   - review_count >= 50 (no thin / suspect listings)
//   - !is_closed (drops permanently closed)
//   - Only food/bar/dessert/coffee categories
//   - Has an image
//
// We pull a few targeted "hot and new" / "highly-rated" queries and dedupe.

import type { Activity, Interest, ActivityCategory } from './activities';

const YELP_ENDPOINT = 'https://api.yelp.com/v3/businesses/search';
const CACHE_MIN = 60 * 6; // these change slowly — cache 6 hours

const cache = new Map<string, { at: number; data: Activity[] }>();

// Yelp category aliases — what we ask for, mapped to our (cat, tags).
const QUERIES: Array<{
  alias: string;       // yelp category
  category: ActivityCategory;
  tags: Interest[];
  sort: 'best_match' | 'rating' | 'review_count';
}> = [
  { alias: 'restaurants',  category: 'food', tags: ['food'],             sort: 'rating' },
  { alias: 'bars',         category: 'food', tags: ['food', 'nightlife'], sort: 'rating' },
  { alias: 'cocktailbars', category: 'food', tags: ['food', 'nightlife'], sort: 'rating' },
  { alias: 'coffee',       category: 'cozy', tags: ['coffee'],            sort: 'rating' },
  { alias: 'desserts',     category: 'food', tags: ['food'],              sort: 'rating' },
];

export async function fetchYelpActivities(opts: { city?: string; perCategory?: number } = {}): Promise<Activity[]> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) return [];

  const city = opts.city || 'Boston, MA';
  const perCat = Math.min(opts.perCategory ?? 6, 10);
  const cacheKey = `${city}|${perCat}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MIN * 60_000) return cached.data;

  const all: Activity[] = [];
  const seen = new Set<string>();

  for (const q of QUERIES) {
    try {
      const url = new URL(YELP_ENDPOINT);
      url.searchParams.set('location', city);
      url.searchParams.set('categories', q.alias);
      url.searchParams.set('limit', String(perCat));
      url.searchParams.set('sort_by', q.sort);
      url.searchParams.set('open_now', 'false'); // we want planning ahead, not "open now"

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        console.warn('Yelp: non-200', { alias: q.alias, status: res.status });
        continue;
      }
      const json: any = await res.json();
      const businesses: any[] = json?.businesses || [];

      for (const b of businesses) {
        if (!b?.id || seen.has(b.id)) continue;
        if (b.is_closed) continue;
        if ((b.rating ?? 0) < 4.0) continue;
        if ((b.review_count ?? 0) < 50) continue;
        if (!b.image_url) continue;

        seen.add(b.id);
        all.push(toActivity(b, q.category, q.tags));
      }
    } catch (err: any) {
      console.warn('Yelp: fetch failed', { alias: q.alias, msg: err?.message });
    }
  }

  cache.set(cacheKey, { at: Date.now(), data: all });
  return all;
}

function toActivity(b: any, category: ActivityCategory, tags: Interest[]): Activity {
  const neighborhood = b.location?.city || b.location?.address1 || '';
  const cats = (b.categories || []).map((c: any) => c.title).slice(0, 2).join(' · ');
  const stars = '★'.repeat(Math.round(b.rating));
  const priceTag = b.price ? ` · ${b.price}` : '';

  return {
    id: `live:yelp:${b.id}`,
    source: 'yelp',
    title: `Try ${b.name}`,
    blurb: `${cats || 'food'} · ${stars} (${b.review_count} reviews)${priceTag}`,
    category,
    tags,
    venue: neighborhood,
    url: b.url,
    imageUrl: b.image_url,
    whenLabel: 'open this week',
  };
}
