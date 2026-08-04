import { supabaseAdmin } from '@/lib/supabase';
import { metroOf, METRO_CENTERS, type Metro } from '@/lib/quiz-data';
import { neighborhoodOf } from '@/lib/neighborhoods';

export type FriendTrip = {
  id: string;
  origin_metro: string;
  destination_metro: string;
  destination_area: string | null;
  starts_on: string;
  ends_on: string;
};

export type FriendLocationContext = {
  homeMetro: Metro | null;
  metro: Metro | null;
  area: string;
  trip: FriendTrip | null;
  // True once a saved trip enters the 30-day discovery window. `trip` can be
  // present earlier so the user can see/cancel a scheduled trip without moving
  // their Friend Line out of the home metro too soon.
  isTraveling: boolean;
  isOnTrip: boolean;
  windowStart: string;
  windowEnd: string;
};

const day = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);
const addDays = (ymd: string, days: number) => {
  const date = new Date(`${ymd}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function friendMetroLabel(metro: string | null | undefined): string | null {
  const center = metro ? METRO_CENTERS[metro] : null;
  return center ? `${center.label || center.city}, ${center.state}` : null;
}

// Travel presence becomes usable 30 days before arrival. That gives a visitor
// time to find a run club or make a small plan without permanently changing
// their home city or putting every metro into one noisy global pool.
export async function friendLocationContext(user: any, now = Date.now()): Promise<FriendLocationContext> {
  const today = day(now);
  const planningEnd = addDays(today, 30);
  const homeMetro = metroOf(user?.zip);
  let trip: FriendTrip | null = null;
  try {
    const { data } = await supabaseAdmin.from('friend_trips')
      .select('id, origin_metro, destination_metro, destination_area, starts_on, ends_on')
      .eq('user_id', user.id).eq('status', 'active')
      .gte('ends_on', today)
      .order('starts_on', { ascending: true }).limit(1).maybeSingle();
    if (data && METRO_CENTERS[data.destination_metro]) trip = data as FriendTrip;
  } catch { /* pre-migration: keep home behavior */ }

  const isTraveling = !!trip && trip.starts_on <= planningEnd;
  const metro = (isTraveling ? trip?.destination_metro as Metro | undefined : null) || homeMetro;
  const area = (isTraveling ? trip?.destination_area || METRO_CENTERS[trip!.destination_metro]?.city : neighborhoodOf(user?.zip)) || 'your area';
  return {
    homeMetro,
    metro,
    area,
    trip,
    isTraveling,
    isOnTrip: !!trip && trip.starts_on <= today && trip.ends_on >= today,
    windowStart: isTraveling ? trip!.starts_on : today,
    windowEnd: isTraveling ? trip!.ends_on : planningEnd,
  };
}

export async function travelerPresenceByUser(
  userIds: string[],
  destinationMetro: string,
  startsOn: string,
  endsOn: string,
): Promise<Map<string, FriendTrip>> {
  if (!userIds.length || !METRO_CENTERS[destinationMetro]) return new Map();
  try {
    const { data } = await supabaseAdmin.from('friend_trips')
      .select('id, user_id, origin_metro, destination_metro, destination_area, starts_on, ends_on')
      .in('user_id', userIds).eq('destination_metro', destinationMetro).eq('status', 'active')
      .lte('starts_on', endsOn).gte('ends_on', startsOn);
    return new Map((data || []).map((trip: any) => [trip.user_id, trip as FriendTrip]));
  } catch { return new Map(); }
}
