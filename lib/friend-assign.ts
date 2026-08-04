import { supabaseAdmin } from '@/lib/supabase';
import { rankFriendCandidates } from '@/lib/friend-matching';
import { FRIEND_MAX_CONNECTIONS } from '@/lib/friend-circles';
import { isFriendCooled } from '@/lib/friend-cooldown';
import { sendPushToUser } from '@/lib/push';
import { metroOf } from '@/lib/quiz-data';
import { friendLocationContext, friendMetroLabel, travelerPresenceByUser } from '@/lib/friend-location';
import { connectionInFriendSegment, travelMatchExpiry, travelSegmentCapacity } from '@/lib/friend-travel';

// Auto-assign: top the user up to the current segment's friend-match capacity by
// score, excluding anyone they already have a connection or history with, and
// respecting the OTHER person's base segment cap too. Idempotent + lazy — safe to call on
// every matches-fetch, so we don't need a cron for v1. Returns # created.
export async function assignFriendMatches(userId: string, max = FRIEND_MAX_CONNECTIONS): Promise<number> {
  const { data: me } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
  if (!me || !me.friend_opted_in_at) return 0;

  // Ghosted/paused users are locked out of BOTH lines until they refresh their
  // profile (which clears the flag). Don't assign them any new friend matches.
  if (me.matching_disabled_at) return 0;
  if (me.matching_cooldown_until && new Date(me.matching_cooldown_until).getTime() > Date.now()) return 0;
  // On a friend-pack break (ignored too many packs) → no new packs until it lifts.
  if (isFriendCooled(me)) return 0;

  // An unaccepted destination introduction should not occupy a local's pack
  // after the shared travel window has ended. Mutual friendships are permanent.
  await supabaseAdmin.from('friend_connections').update({ status: 'declined' })
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq('status', 'pending').not('match_expires_at', 'is', null)
    .lt('match_expires_at', new Date().toISOString());

  const { data: conns } = await supabaseAdmin
    .from('friend_connections')
    .select('user_a_id, user_b_id, status, match_metro')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
  const location = await friendLocationContext(me);
  const targetMetro = location.metro;
  const segmentMax = location.isTraveling ? travelSegmentCapacity(max, FRIEND_MAX_CONNECTIONS) : max;
  const active = (conns ?? []).filter((c: any) => c.status !== 'declined' && (
    connectionInFriendSegment(c, targetMetro, location.isTraveling)
  ));
  if (active.length >= segmentMax) return 0;
  const need = segmentMax - active.length;

  const { data: hist } = await supabaseAdmin
    .from('friend_match_history')
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
  const seen = new Set<string>();
  [...(conns ?? []), ...(hist ?? [])].forEach((r: any) =>
    seen.add(r.user_a_id === userId ? r.user_b_id : r.user_a_id)
  );

  const { data: pool } = await supabaseAdmin
    .from('users')
    // Only the fields the friend matcher actually reads — was `select('*')`,
    // a PII over-fetch (email/bio/gallery/love-columns) for the whole friend
    // pool on every roster load. Mirrors the love-roster trim.
    .select('id, age, gender, is_lgbtq, friend_age_min, friend_age_max, friend_seeking, friend_vibes, zip, score_openness, score_extraversion, score_agreeableness, score_honesty, score_conscientiousness')
    .not('friend_opted_in_at', 'is', null)
    .is('deleted_at', null)
    // Exclude ghosted/paused users — they don't surface to anyone on either line.
    .is('matching_disabled_at', null)
    .or(`matching_cooldown_until.is.null,matching_cooldown_until.lt.${new Date().toISOString()}`)
    .neq('id', userId);

  // Realm segregation: test accounts only crew up with other test accounts;
  // real users never get matched to a test account (and vice-versa).
  const meTest = (me as any).is_test === true;
  // Friend matching is metro-bounded — you crew up across your WHOLE metro (no
  // radius), but never cross-metro (a Boston user shouldn't be friend-matched to
  // NYC). If we can't resolve the user's metro, fall back to no geo filter.
  const myMetro = targetMetro;
  const candidateTrips = myMetro
    ? await travelerPresenceByUser((pool ?? []).map((candidate: any) => candidate.id), myMetro, location.windowStart, location.windowEnd)
    : new Map();
  const fresh = (pool ?? []).filter((p) =>
    !seen.has(p.id) &&
    (((p as any).is_test === true) === meTest) &&
    (!myMetro || metroOf((p as any).zip) === myMetro || candidateTrips.has(p.id))
  );
  const ranked = rankFriendCandidates(me, fresh);

  const meFirst = ((me as any).name || 'Someone').split(' ')[0];
  const pushes: Promise<boolean>[] = [];
  let created = 0;
  // Batch every ranked candidate's active-connection count in ONE query (was an
  // N+1 — one friend_connections lookup per candidate inside the loop below).
  const candIds = ranked.map((r) => r.user.id);
  const candActiveCount = new Map<string, number>();
  if (candIds.length) {
    const { data: allConns } = await supabaseAdmin
      .from('friend_connections')
      .select('user_a_id, user_b_id, status, match_metro, match_expires_at')
      .neq('status', 'declined')
      .or(`match_expires_at.is.null,match_expires_at.gt.${new Date().toISOString()}`)
      .or(`user_a_id.in.(${candIds.join(',')}),user_b_id.in.(${candIds.join(',')})`);
    const candSet = new Set(candIds);
    const candidateById = new Map((pool ?? []).map((candidate: any) => [candidate.id, candidate]));
    const countsInTarget = (candidateId: string, connection: any) => {
      if (!myMetro) return true;
      if (connection.match_metro) return connection.match_metro === myMetro;
      return metroOf((candidateById.get(candidateId) as any)?.zip) === myMetro;
    };
    for (const c of allConns ?? []) {
      if (candSet.has(c.user_a_id) && countsInTarget(c.user_a_id, c)) candActiveCount.set(c.user_a_id, (candActiveCount.get(c.user_a_id) || 0) + 1);
      if (candSet.has(c.user_b_id) && countsInTarget(c.user_b_id, c)) candActiveCount.set(c.user_b_id, (candActiveCount.get(c.user_b_id) || 0) + 1);
    }
  }
  for (const { user: cand, score } of ranked) {
    if (created >= need) break;
    // Respect the candidate's own active-cap so we don't overload popular users.
    const candActive = candActiveCount.get(cand.id) || 0;
    // Protect the candidate by their BASE cap (not the buyer's expanded cap), so
    // buying extra rounds never overloads someone else's roster.
    if (candActive >= FRIEND_MAX_CONNECTIONS) continue;

    const [a, b] = [userId, cand.id].sort();
    const candidateTrip = candidateTrips.get(cand.id);
    const travelers = [location.isTraveling ? userId : null, candidateTrips.has(cand.id) ? cand.id : null].filter(Boolean);
    const tripWindows: Record<string, { startsOn: string; endsOn: string }> = {};
    if (location.isTraveling) tripWindows[userId] = { startsOn: location.windowStart, endsOn: location.windowEnd };
    if (candidateTrip) tripWindows[cand.id] = { startsOn: candidateTrip.starts_on, endsOn: candidateTrip.ends_on };
    const { error } = await supabaseAdmin.from('friend_connections').upsert(
      {
        user_a_id: a, user_b_id: b, status: 'pending', compatibility_score: score,
        match_metro: myMetro,
        match_expires_at: travelMatchExpiry(Object.values(tripWindows).map((window) => window.endsOn)),
        match_context: { travelers, tripWindows },
      },
      { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: true }
    );
    if (!error) {
      created++;
      // The candidate just got matched without lifting a finger — ping them so
      // the Friend Line isn't a one-sided silence (their only friend-match ping).
      pushes.push(
        sendPushToUser(cand.id, {
          title: 'New friend match 🧡',
          body: `${meFirst} could be your kind of people${friendMetroLabel(myMetro) ? ` in ${friendMetroLabel(myMetro)}` : ''} — say hi on the Friend Line.`,
          url: '/friends',
          tag: `friend-match-${cand.id}`,
        })
      );
    }
  }
  // Awaited (not fire-and-forget) so Vercel can't kill the only friend-match
  // ping; allSettled runs them concurrently + a dead sub never throws.
  if (pushes.length) await Promise.allSettled(pushes);
  return created;
}

// A user's match cap = the base pack, plus one base-sized paid/Pro round.
// Tolerant: if the friend_match_rounds table isn't migrated yet, fall back to base.
export async function matchCapFor(userId: string): Promise<number> {
  try {
    const { count } = await supabaseAdmin
      .from('friend_match_rounds')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    return FRIEND_MAX_CONNECTIONS * (1 + (count ?? 0));
  } catch {
    return FRIEND_MAX_CONNECTIONS;
  }
}
