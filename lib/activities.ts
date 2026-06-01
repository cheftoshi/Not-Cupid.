// Shared activity types + the curated Boston deck.
//
// Activities come from two sources:
//   - 'curated'    — hand-picked items defined here (always available)
//   - 'ticketmaster' — live local events fetched in lib/ticketmaster.ts
// Both conform to the Activity shape below so the UI doesn't care
// where they came from.

export type ActivityCategory = 'food' | 'outdoor' | 'cultural' | 'cozy' | 'adventurous';

// Interest tags users can pick from. Activities are tagged with these too,
// and the deck filter is based on the intersection between user picks and
// activity tags.
export const INTEREST_OPTIONS = [
  { value: 'food',      label: '🍜 food' },
  { value: 'music',     label: '🎵 music' },
  { value: 'sports',    label: '🏟 sports' },
  { value: 'comedy',    label: '🎤 comedy' },
  { value: 'art',       label: '🎨 art' },
  { value: 'theater',   label: '🎭 theater' },
  { value: 'outdoor',   label: '🌳 outdoor' },
  { value: 'nightlife', label: '🍸 nightlife' },
  { value: 'coffee',    label: '☕ coffee' },
  { value: 'films',     label: '🎬 films' },
  { value: 'books',     label: '📚 books' },
  { value: 'gaming',    label: '🎮 gaming' },
] as const;

export type Interest = typeof INTEREST_OPTIONS[number]['value'];

export const CATEGORIES: ActivityCategory[] = ['food', 'outdoor', 'cultural', 'cozy', 'adventurous'];

export type ActivitySource = 'curated' | 'ticketmaster' | 'yelp' | 'boston-calendar';

export interface Activity {
  id: string;                  // 'curated:<slug>' / 'live:tm:<id>' / 'live:yelp:<id>' / 'live:cal:<id>'
  source: ActivitySource;
  title: string;
  blurb: string;
  category: ActivityCategory;
  tags: Interest[];            // intersect with user interests for filtering
  venue?: string;
  url?: string;                // ticket / info link
  imageUrl?: string;
  whenLabel?: string;          // 'Fri Jun 6 · 7pm' (live events) or null for curated
  tier?: 1 | 2 | 3;            // date-progression tier (see activityTier)
}

// ─── The curated Boston deck ──────────────────────────────────────────────
// Edit freely — these are intentionally low-effort, Boston-flavored, mostly
// free or cheap so they don't pressure anyone into spending.

export const CURATED_ACTIVITIES: Activity[] = [
  // FOOD
  { id: 'curated:dim-sum-chinatown', source: 'curated', category: 'food',
    title: 'Dim sum crawl in Chinatown',
    blurb: 'Hit Hei La Moon then waddle to Great Taste. Worth it.',
    tags: ['food'], venue: 'Chinatown' },
  { id: 'curated:north-end-cannoli', source: 'curated', category: 'food',
    title: 'Cannoli showdown: Mike\'s vs Modern',
    blurb: 'Get one from each. Eat them on a bench on Hanover. Pick a winner.',
    tags: ['food'], venue: 'North End' },
  { id: 'curated:tasting-eataly', source: 'curated', category: 'food',
    title: 'Wander Eataly together',
    blurb: 'Grab small plates at each counter. Pretend you\'re in Italy.',
    tags: ['food'], venue: 'Prudential Center' },
  { id: 'curated:smoke-shop-bbq', source: 'curated', category: 'food',
    title: 'BBQ + bourbon at Smoke Shop',
    blurb: 'Cambridge institution. Brisket and a flight, no plans after.',
    tags: ['food'], venue: 'Kendall Square' },
  { id: 'curated:little-donkey', source: 'curated', category: 'food',
    title: 'Tapas at Little Donkey',
    blurb: 'Shareable everything. Order 1 too many things on purpose.',
    tags: ['food'], venue: 'Central Square' },

  // OUTDOOR
  { id: 'curated:walk-esplanade', source: 'curated', category: 'outdoor',
    title: 'Walk the Esplanade at golden hour',
    blurb: 'Charles River, the boats, the joggers. Free, easy, classic.',
    tags: ['outdoor'], venue: 'Back Bay' },
  { id: 'curated:arnold-arboretum', source: 'curated', category: 'outdoor',
    title: 'Get lost in the Arnold Arboretum',
    blurb: '281 acres of trees, hardly anyone there. Pack a coffee.',
    tags: ['outdoor', 'coffee'], venue: 'Jamaica Plain' },
  { id: 'curated:swan-boats', source: 'curated', category: 'outdoor',
    title: 'Swan boats + Public Garden',
    blurb: 'Touristy yes. Romantic also yes. Lean in.',
    tags: ['outdoor'], venue: 'Public Garden' },
  { id: 'curated:harborwalk', source: 'curated', category: 'outdoor',
    title: 'Walk the HarborWalk from Aquarium to Seaport',
    blurb: 'About a mile, ends with food in Seaport. Built-in plan B.',
    tags: ['outdoor', 'food'], venue: 'Downtown → Seaport' },
  { id: 'curated:blue-hills-hike', source: 'curated', category: 'adventurous',
    title: 'Skyline Trail at Blue Hills',
    blurb: '7 miles, real elevation, panoramic views. Bring water.',
    tags: ['outdoor', 'sports'], venue: 'Milton' },
  { id: 'curated:castle-island', source: 'curated', category: 'outdoor',
    title: 'Sullivan\'s + Castle Island loop',
    blurb: 'Hot dogs, harbor breeze, planes landing overhead. Old Boston.',
    tags: ['outdoor', 'food'], venue: 'South Boston' },

  // CULTURAL
  { id: 'curated:mfa-first-friday', source: 'curated', category: 'cultural',
    title: 'MFA First Friday (free + drinks)',
    blurb: 'Museum after-hours with live music. Way better than a Tinder bar.',
    tags: ['art', 'music'], venue: 'Museum of Fine Arts' },
  { id: 'curated:isabella-stewart-gardner', source: 'curated', category: 'cultural',
    title: 'Gardner Museum (free if your name is Isabella)',
    blurb: 'Stolen-Rembrandt vibes, courtyard garden, weird and great.',
    tags: ['art'], venue: 'Fenway' },
  { id: 'curated:brattle-double-feature', source: 'curated', category: 'cultural',
    title: 'Brattle Theatre double feature',
    blurb: 'Indie / repertory cinema in Harvard Sq. Their schedule slaps.',
    tags: ['films'], venue: 'Harvard Square' },
  { id: 'curated:harvard-bookstore', source: 'curated', category: 'cozy',
    title: 'Harvard Book Store + coffee after',
    blurb: 'Browse together, buy each other one book. Show your hand.',
    tags: ['books', 'coffee'], venue: 'Harvard Square' },
  { id: 'curated:improv-asylum', source: 'curated', category: 'cultural',
    title: 'ImprovBoston / Improv Asylum',
    blurb: 'Late show. Cheap, fast, gives you stuff to talk about after.',
    tags: ['comedy', 'theater'], venue: 'Cambridge / North End' },
  { id: 'curated:trident-bookstore-brunch', source: 'curated', category: 'cozy',
    title: 'Trident Booksellers brunch',
    blurb: 'Books + pancakes + zero rush. Pre-noon energy.',
    tags: ['books', 'coffee', 'food'], venue: 'Newbury Street' },

  // COZY
  { id: 'curated:lamplighter-coffee', source: 'curated', category: 'cozy',
    title: 'Coffee + write each other a haiku',
    blurb: 'At Lamplighter. Five minutes, no rules, no take-backs.',
    tags: ['coffee', 'books'], venue: 'Cambridge' },
  { id: 'curated:roastery-tasting', source: 'curated', category: 'cozy',
    title: 'George Howell tasting flight',
    blurb: 'Three coffees side by side at Godfrey. Pretend you can taste it.',
    tags: ['coffee'], venue: 'Downtown Crossing' },
  { id: 'curated:tea-room', source: 'curated', category: 'cozy',
    title: 'Afternoon tea at the Bristol (Four Seasons)',
    blurb: 'A little fancy. Three tiers of tiny food. Worth the move.',
    tags: ['food', 'coffee'], venue: 'Boston Common' },
  { id: 'curated:board-game-cafe', source: 'curated', category: 'cozy',
    title: 'A&G Pizza + board games at Knight Moves',
    blurb: 'Pick a 30-min game so you don\'t get stuck for 4 hours.',
    tags: ['gaming', 'food'], venue: 'Brookline' },

  // ADVENTUROUS
  { id: 'curated:topgolf-night', source: 'curated', category: 'adventurous',
    title: 'TopGolf Canton (or any bay reservation)',
    blurb: 'Even non-golfers have fun. Loud, drinks, low-pressure.',
    tags: ['sports'], venue: 'Canton' },
  { id: 'curated:axe-throwing', source: 'curated', category: 'adventurous',
    title: 'Axe throwing at Boston Axe',
    blurb: 'Yes, it\'s a thing. Yes, you should try it.',
    tags: ['sports'], venue: 'Everett' },
  { id: 'curated:duckpin-bowling', source: 'curated', category: 'adventurous',
    title: 'Duckpin bowling at Sacco\'s',
    blurb: 'Tiny balls, no holes, way more chaotic than regular bowling.',
    tags: ['sports'], venue: 'Davis Square' },
  { id: 'curated:kayak-charles', source: 'curated', category: 'adventurous',
    title: 'Kayak the Charles from CRR',
    blurb: 'Rent for 2 hours. Don\'t flip it. Skyline views from the water.',
    tags: ['outdoor', 'sports'], venue: 'Cambridge boathouse' },
  { id: 'curated:salem-day-trip', source: 'curated', category: 'adventurous',
    title: 'Day trip to Salem',
    blurb: '30 min on the commuter rail. Witches, harbor, weird shops.',
    tags: ['outdoor'], venue: 'Salem, MA' },
  { id: 'curated:walden-pond', source: 'curated', category: 'adventurous',
    title: 'Swim at Walden Pond',
    blurb: 'Thoreau\'s pond, summer only, real lake water. Surprisingly cold.',
    tags: ['outdoor'], venue: 'Concord' },

  // NIGHTLIFE / MUSIC
  { id: 'curated:sinclair-show', source: 'curated', category: 'cultural',
    title: 'Pick a random show at The Sinclair',
    blurb: 'Don\'t know the band. Buy tix anyway. Trust the venue.',
    tags: ['music', 'nightlife'], venue: 'Harvard Square' },
  { id: 'curated:wally-cafe-jazz', source: 'curated', category: 'cozy',
    title: 'Late jazz at Wally\'s Cafe',
    blurb: 'Oldest jazz club in Boston. Cash only. No reservations.',
    tags: ['music', 'nightlife'], venue: 'South End' },
  { id: 'curated:silvertone-bar', source: 'curated', category: 'cozy',
    title: 'Silvertone basement vibes',
    blurb: 'Mac & cheese, dim lighting, you can actually hear each other.',
    tags: ['food', 'nightlife'], venue: 'Downtown Crossing' },

  // GETTING-TO-KNOW (light prompts seeded as cards too)
  { id: 'curated:question-game-park', source: 'curated', category: 'cozy',
    title: 'Question swap in the Common',
    blurb: 'Bring your weirdest first-date question. Trade three rounds.',
    tags: ['outdoor'], venue: 'Boston Common' },
  { id: 'curated:diy-photo-walk', source: 'curated', category: 'cultural',
    title: 'Photo walk: each shoot 10 frames of the other',
    blurb: 'Phones are fine. Best one becomes your new contact pic.',
    tags: ['art', 'outdoor'], venue: 'pick any neighborhood' },
];

// ─── Date-progression tiers ────────────────────────────────────────────
// 1 = first date (light, public, low-pressure — coffee, walks, museums)
// 2 = getting closer (involved — dinner, shows, an activity together)
// 3 = the one that counts (intimate / adventurous — cook, day trips, late
//     jazz). The goal: by date 3 they're off the app and into a real thing.
const ACTIVITY_TIER: Record<string, 1 | 2 | 3> = {
  // tier 1 — keep it light
  'curated:north-end-cannoli': 1,
  'curated:walk-esplanade': 1,
  'curated:arnold-arboretum': 1,
  'curated:swan-boats': 1,
  'curated:castle-island': 1,
  'curated:mfa-first-friday': 1,
  'curated:isabella-stewart-gardner': 1,
  'curated:harvard-bookstore': 1,
  'curated:trident-bookstore-brunch': 1,
  'curated:lamplighter-coffee': 1,
  'curated:roastery-tasting': 1,
  'curated:question-game-park': 1,
  'curated:diy-photo-walk': 1,
  // tier 2 — getting closer
  'curated:dim-sum-chinatown': 2,
  'curated:tasting-eataly': 2,
  'curated:smoke-shop-bbq': 2,
  'curated:little-donkey': 2,
  'curated:harborwalk': 2,
  'curated:brattle-double-feature': 2,
  'curated:improv-asylum': 2,
  'curated:tea-room': 2,
  'curated:board-game-cafe': 2,
  'curated:topgolf-night': 2,
  'curated:axe-throwing': 2,
  'curated:duckpin-bowling': 2,
  'curated:sinclair-show': 2,
  'curated:silvertone-bar': 2,
  // tier 3 — the one that counts
  'curated:blue-hills-hike': 3,
  'curated:kayak-charles': 3,
  'curated:salem-day-trip': 3,
  'curated:walden-pond': 3,
  'curated:wally-cafe-jazz': 3,
};

const CATEGORY_TIER_FALLBACK: Record<ActivityCategory, 1 | 2 | 3> = {
  cozy: 1,
  outdoor: 1,
  cultural: 2,
  food: 2,
  adventurous: 3,
};

// Effective tier for any activity (curated override → category fallback).
// Live events (Ticketmaster/Yelp/Calendar) have no explicit tier, so they
// slot in by category.
export function activityTier(a: Activity): 1 | 2 | 3 {
  return a.tier ?? ACTIVITY_TIER[a.id] ?? CATEGORY_TIER_FALLBACK[a.category] ?? 1;
}

// Filter the deck for a given user pair on a given date number.
// - Interest gate: include activities matching at least one interest from
//   the union of both picks (no over-filtering when nobody has picked).
// - Tier gate: only activities at or below the current date tier, so the
//   menu escalates as the couple progresses (date 1 = tier 1 only, date 3
//   unlocks everything including the intimate options).
export function filterDeck(
  deck: Activity[],
  userInterests: Interest[],
  partnerInterests: Interest[],
  maxTier: 1 | 2 | 3 = 3,
): Activity[] {
  const union = new Set<Interest>([...(userInterests || []), ...(partnerInterests || [])]);
  return deck.filter((a) => {
    // Curated items escalate by tier (date 1 = light/public, date 3 = all in).
    // Live real-world events are time-sensitive, so they always surface
    // regardless of date number — only the interest gate applies to them.
    if (a.source === 'curated' && activityTier(a) > maxTier) return false;
    if (union.size === 0) return true;
    return a.tags.some((t) => union.has(t));
  });
}
