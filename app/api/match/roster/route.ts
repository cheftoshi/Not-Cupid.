// GET /api/match/roster
//
// The curated roster: the caller's top compatible candidates to CHOOSE from
// (vs. the algo assigning one). Computed live with the same scoring as the
// auto-matcher, so it always agrees on eligibility. Returns only safe public
// fields. Empty if the user already has an open match (the dashboard shows
// the match card in that case).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { rankCandidates } from '@/lib/matching';
import { releaseTimedOutMatches, liveMatchesFor, isMatchLive, MAX_CONNECTIONS, MAX_IGNORED_PICKS } from '@/lib/match-actions';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { isHardLocked } from '@/lib/ghost';

// ZIP → human metro label (e.g. "Boston, MA"), or "Boston area" fallback.
// Never returns the raw ZIP — that's a location-privacy leak.
function metroLabel(zip: string | null | undefined): string {
  const m = metroOf(zip);
  if (m && METRO_CENTERS[m]) return `${METRO_CENTERS[m].city}, ${METRO_CENTERS[m].state}`;
  return 'Boston area';
}

export const dynamic = 'force-dynamic';

const ROSTER_SIZE = 5;
// The scarce side gets a bigger roster. In a male-skewed pool that means
// women seeking men (or anyone) get more options — but NOT women seeking
// women, whose sought pool is itself thin, so a bigger number would just
// show empty slots.
const ROSTER_SIZE_SCARCE = 8;

// Roster snapshot rotates at most every 12h. Within that window the same
// people show (minus any who got taken, with fresh backfill), so the roster
// feels stable instead of reshuffling on every reload.
const ROSTER_TTL_MS = 12 * 60 * 60 * 1000;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Free any of the caller's timed-out matches first, so a just-expired match
  // doesn't block their roster (and so they show as 'waiting' for picking).
  await releaseTimedOutMatches(user.id);

  // Capacity model: you can run up to MAX_CONNECTIONS live conversations. The
  // roster keeps showing until you're maxed out (it no longer disappears the
  // moment you have one match). We also exclude anyone you're already talking to.
  const now = Date.now();
  const myLive = await liveMatchesFor(user.id);
  const livePartnerIds = new Set<string>(
    myLive.map((m: any) => (m.user_1_id === user.id ? m.user_2_id : m.user_1_id))
  );
  // At capacity, the roster is still BROWSABLE — the user just can't open a new
  // chat without closing one first (the client gates picking on `atCapacity`).
  const atCapacity = myLive.length >= MAX_CONNECTIONS;
  if (user.pool_active === false) return NextResponse.json({ roster: [], paused: true });

  // Ghosted/paused users are locked out of matching on BOTH lines. They can
  // self-reactivate (free, non-destructive) unless they're past the hard cap,
  // in which case only an admin can restore them.
  const cooldownActive = user.matching_cooldown_until && new Date(user.matching_cooldown_until).getTime() > now;
  if (user.matching_disabled_at || cooldownActive) {
    return NextResponse.json({ roster: [], ghosted: true, hardLocked: isHardLocked(user.ghost_strikes) });
  }

  // Fully free (no live matches) but status got stuck → normalize to 'waiting'
  // so back-compat consumers (pools/legacy) read them correctly.
  if (myLive.length === 0 && user.status !== 'waiting') {
    await supabaseAdmin.from('users').update({ status: 'waiting' }).eq('id', user.id);
  }

  // Candidate pool. We no longer filter by status='waiting' (that was the
  // single-match lock) — instead we surface anyone with spare capacity and
  // filter out those at the cap below.
  // Select ONLY what ranking + the response need — `select('*')` was hauling
  // every column (email, bio, gallery, roster_snapshot…) for the whole active
  // pool on every roster load: a PII over-fetch that scales with user count.
  const POOL_COLS =
    'id, name, age, gender, seeking, age_min, age_max, zip, photo_url, archetype, ' +
    'relationship_style, vibes, values_profile, attach_anxiety, attach_avoidance, attach_style, ' +
    'score_honesty, score_emotionality, score_extraversion, score_agreeableness, ' +
    'score_conscientiousness, score_openness, last_matched_at, is_test';
  const nowIso = new Date().toISOString();
  // Responsiveness gate: bench chronic no-shows (ignored_picks > MAX_IGNORED_PICKS)
  // so the pool stops surfacing people who never accept. `applyIgnored` is dropped
  // on the pre-migration fallback below if the column doesn't exist yet.
  const buildPool = (applyIgnored: boolean) => {
    let q = supabaseAdmin
      .from('users')
      .select(POOL_COLS)
      .eq('pool_active', true)
      .eq('is_blocked', false)
      .neq('id', user.id)
      .is('matching_disabled_at', null)
      .is('deleted_at', null)
      .or(`matching_cooldown_until.is.null,matching_cooldown_until.lt.${nowIso}`);
    // Realm segregation: test ↔ test, real ↔ real only.
    q = (user as any).is_test === true ? q.eq('is_test', true) : q.not('is_test', 'is', true);
    if (applyIgnored) q = q.lte('ignored_picks', MAX_IGNORED_PICKS);
    return q;
  };
  let { data: pool, error: poolErr } = await buildPool(true);
  if (poolErr) {
    // ignored_picks not migrated yet (or other error) → retry without that filter.
    ({ data: pool } = await buildPool(false));
  }

  if (!pool || pool.length === 0) return NextResponse.json({ roster: [], atCapacity });

  // Wait-time decay input (same derivation as /api/match).
  const { data: lastEnded } = await supabaseAdmin
    .from('matches')
    .select('ended_at')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const waitStartMs = lastEnded?.ended_at ? new Date(lastEnded.ended_at).getTime() : new Date(user.created_at).getTime();
  const waitDays = Math.max(0, (Date.now() - waitStartMs) / 86_400_000);

  // Exclude anyone this user has already matched with before (no repeats) AND
  // anyone they're currently in a live conversation with.
  const { data: history } = await supabaseAdmin
    .from('match_history')
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
  const seen = new Set<string>(livePartnerIds);
  for (const h of history ?? []) {
    seen.add(h.user_a_id === user.id ? h.user_b_id : h.user_a_id);
  }
  let freshPool = pool.filter((p: any) => !seen.has(p.id));

  // Drop candidates who are already at the connection cap (no spare capacity).
  // Batch-fetch every live match touching the pool, then count per candidate.
  if (freshPool.length > 0) {
    const poolIds = freshPool.map((p: any) => p.id);
    const [{ data: m1 }, { data: m2 }] = await Promise.all([
      supabaseAdmin.from('matches')
        .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, expires_at, status, ended_at')
        .in('user_1_id', poolIds).is('ended_at', null).neq('status', 'expired'),
      supabaseAdmin.from('matches')
        .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, expires_at, status, ended_at')
        .in('user_2_id', poolIds).is('ended_at', null).neq('status', 'expired'),
    ]);
    const byId = new Map<string, any>();
    for (const m of [...(m1 ?? []), ...(m2 ?? [])]) byId.set(m.id, m);
    const liveCount = new Map<string, number>();
    const poolSet = new Set(poolIds);
    for (const m of byId.values()) {
      if (!isMatchLive(m)) continue;
      for (const uid of [m.user_1_id, m.user_2_id]) {
        if (poolSet.has(uid)) liveCount.set(uid, (liveCount.get(uid) || 0) + 1);
      }
    }
    freshPool = freshPool.filter((p: any) => (liveCount.get(p.id) || 0) < MAX_CONNECTIONS);
  }

  const { ranked } = rankCandidates(user, freshPool, { waitDays });
  // Bigger roster for women seeking men/anyone (scarce side); 5 otherwise.
  const size = user.gender === 'f' && user.seeking !== 'f' ? ROSTER_SIZE_SCARCE : ROSTER_SIZE;

  // Map of currently-eligible candidates by id (for snapshot validation +
  // hydration). Anyone in the prior snapshot who's since been taken / matched /
  // dropped out simply won't be in here and gets filtered out.
  const eligibleById = new Map(ranked.map((c) => [c.user.id, c]));

  // Decide the ordered list of candidate ids for this roster.
  const snapshot: string[] = Array.isArray(user.roster_snapshot) ? user.roster_snapshot : [];
  const refreshedAt = user.roster_refreshed_at ? new Date(user.roster_refreshed_at).getTime() : 0;
  const snapshotFresh = refreshedAt > 0 && Date.now() - refreshedAt < ROSTER_TTL_MS;

  let orderedIds: string[];
  let persist = false;

  if (snapshotFresh) {
    // Keep the snapshot's still-eligible members in their original order, then
    // backfill from the live ranking to keep the roster full when people drop.
    const kept = snapshot.filter((id) => eligibleById.has(id));
    const keptSet = new Set(kept);
    const backfill = ranked.map((c) => c.user.id).filter((id) => !keptSet.has(id));
    orderedIds = [...kept, ...backfill].slice(0, size);
    // Only re-persist if the membership actually changed (backfill kicked in).
    if (kept.length < Math.min(snapshot.length, size)) persist = true;
  } else {
    // Stale or no snapshot → recompute fresh and persist with a new timestamp.
    orderedIds = ranked.slice(0, size).map((c) => c.user.id);
    persist = true;
  }

  const roster = orderedIds
    .map((id) => eligibleById.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({
      id: c.user.id,
      name: c.user.name,
      age: c.user.age,
      photo_url: c.user.photo_url,
      archetype: c.user.archetype,
      // Privacy: never expose the exact ZIP. Show the metro label only.
      metro: metroLabel(c.user.zip),
      relationship_style: c.user.relationship_style,
      score: c.score,
    }));

  if (persist) {
    // Fresh recompute resets the 12h clock; a backfill-only change keeps the
    // existing clock so the rotation cadence stays honest.
    const updates: Record<string, any> = { roster_snapshot: roster.map((r) => r.id) };
    if (!snapshotFresh) updates.roster_refreshed_at = new Date().toISOString();
    await supabaseAdmin.from('users').update(updates).eq('id', user.id);
  }

  return NextResponse.json({ roster, atCapacity });
}
