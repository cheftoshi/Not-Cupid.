// Live-events aggregator. Single entry point for the date-vibes route
// and the admin preview.
//
// Pulls in parallel from the three external sources, applies the admin
// blacklist (so any event you've hidden never reappears), and returns a
// unified Activity[]. Each source already has its own caching + graceful
// degradation when the API key is missing.

import { supabaseAdmin } from '@/lib/supabase';
import type { Activity } from './activities';
import { fetchLiveActivities as fetchTicketmaster } from './ticketmaster';
import { fetchYelpActivities } from './yelp';
import { fetchBostonCalendarActivities } from './boston-calendar';
import { METRO_CENTERS, type Metro } from './quiz-data';

// Pull live events for a given metro (defaults to Boston). Ticketmaster +
// Yelp are queried for that metro's city; Boston Calendar (a Boston-only
// RSS feed) is only included for the Boston metro.
export async function fetchAllLiveActivities(metro: Metro = 'boston'): Promise<Activity[]> {
  const center = METRO_CENTERS[metro] || METRO_CENTERS.boston;
  const yelpLocation = `${center.city}, ${center.state}`;

  const [tm, yelp, cal, blacklist] = await Promise.all([
    safe(fetchTicketmaster({ city: center.city, metro, size: 50 })),
    safe(fetchYelpActivities({ city: yelpLocation, perCategory: 6 })),
    safe(metro === 'boston' ? fetchBostonCalendarActivities() : Promise.resolve([])),
    loadBlacklist(),
  ]);

  const all = [...tm, ...yelp, ...cal];
  if (blacklist.size === 0) return all;
  return all.filter((a) => !blacklist.has(a.id));
}

async function loadBlacklist(): Promise<Set<string>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('live_activity_blacklist')
      .select('activity_id');
    if (error) {
      console.warn('blacklist load failed', error);
      return new Set();
    }
    return new Set((data ?? []).map((r: any) => r.activity_id as string));
  } catch (e) {
    console.warn('blacklist load threw', e);
    return new Set();
  }
}

async function safe<T>(p: Promise<T[]>): Promise<T[]> {
  try { return await p; } catch { return []; }
}
