import { supabaseAdmin } from '@/lib/supabase';
import { rankFriendCandidates } from '@/lib/friend-matching';
import { FRIEND_MAX_CONNECTIONS } from '@/lib/friend-circles';
import { isFriendCooled } from '@/lib/friend-cooldown';
import { sendPushToUser } from '@/lib/push';
import { metroOf } from '@/lib/quiz-data';

// Auto-assign: top the user up to FRIEND_MAX_CONNECTIONS (5) friend matches by
// score, excluding anyone they already have a connection or history with, and
// respecting the OTHER person's 5-cap too. Idempotent + lazy — safe to call on
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

  const { data: conns } = await supabaseAdmin
    .from('friend_connections')
    .select('user_a_id, user_b_id, status')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
  const active = (conns ?? []).filter((c) => c.status !== 'declined');
  if (active.length >= max) return 0;
  const need = max - active.length;

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
    .select('id, age, gender, is_lgbtq, friend_age_min, friend_age_max, friend_seeking, friend_vibes, zip')
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
  const myMetro = metroOf((me as any).zip);
  const fresh = (pool ?? []).filter((p) =>
    !seen.has(p.id) &&
    (((p as any).is_test === true) === meTest) &&
    (!myMetro || metroOf((p as any).zip) === myMetro)
  );
  const ranked = rankFriendCandidates(me, fresh);

  const meFirst = ((me as any).name || 'Someone').split(' ')[0];
  const pushes: Promise<void>[] = [];
  let created = 0;
  for (const { user: cand, score } of ranked) {
    if (created >= need) break;
    // Respect the candidate's own active-cap so we don't overload popular users.
    const { data: candConns } = await supabaseAdmin
      .from('friend_connections')
      .select('status')
      .or(`user_a_id.eq.${cand.id},user_b_id.eq.${cand.id}`);
    const candActive = (candConns ?? []).filter((c) => c.status !== 'declined').length;
    // Protect the candidate by their BASE cap (not the buyer's expanded cap), so
    // buying extra rounds never overloads someone else's roster.
    if (candActive >= FRIEND_MAX_CONNECTIONS) continue;

    const [a, b] = [userId, cand.id].sort();
    const { error } = await supabaseAdmin.from('friend_connections').upsert(
      { user_a_id: a, user_b_id: b, status: 'pending', compatibility_score: score },
      { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: true }
    );
    if (!error) {
      created++;
      // The candidate just got matched without lifting a finger — ping them so
      // the Friend Line isn't a one-sided silence (their only friend-match ping).
      pushes.push(
        sendPushToUser(cand.id, {
          title: 'New friend match 🧡',
          body: `${meFirst} could be your kind of people — say hi on the Friend Line.`,
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

// A user's match cap = base 5, plus 5 for every paid "another round" ($0.99).
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
