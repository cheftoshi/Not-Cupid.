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
import { releaseTimedOutMatches } from '@/lib/match-actions';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';

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

  // If the user has a LIVE match, no roster — they're committed (one at a
  // time). "Live" = both-accepted, or a pending match still within its accept
  // window. A timed-out pending match (expires_at passed) does NOT count, so
  // the roster shows again even before the cron sweeps it.
  const { data: openMatches } = await supabaseAdmin
    .from('matches')
    .select('user_1_accepted, user_2_accepted, expires_at')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .is('ended_at', null)
    .neq('status', 'expired');

  const now = Date.now();
  const hasLive = (openMatches ?? []).some((m: any) => {
    const both = m.user_1_accepted && m.user_2_accepted;
    if (both) return true;
    return !m.expires_at || new Date(m.expires_at).getTime() >= now; // still in window
  });

  if (hasLive) return NextResponse.json({ roster: [], hasOpenMatch: true });
  if (user.pool_active === false) return NextResponse.json({ roster: [], paused: true });

  // Ghosted/paused users are locked out of matching on BOTH lines until they
  // refresh their profile (which clears the flag and starts them over).
  const cooldownActive = user.matching_cooldown_until && new Date(user.matching_cooldown_until).getTime() > now;
  if (user.matching_disabled_at || cooldownActive) {
    return NextResponse.json({ roster: [], ghosted: true });
  }

  const nowIso = new Date().toISOString();
  const { data: pool } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('status', 'waiting')
    .eq('pool_active', true)
    .eq('is_blocked', false)
    .neq('id', user.id)
    .is('matching_disabled_at', null)
    .or(`matching_cooldown_until.is.null,matching_cooldown_until.lt.${nowIso}`);

  if (!pool || pool.length === 0) return NextResponse.json({ roster: [] });

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

  // Exclude anyone this user has already matched with before (no repeats).
  const { data: history } = await supabaseAdmin
    .from('match_history')
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
  const seen = new Set<string>();
  for (const h of history ?? []) {
    seen.add(h.user_a_id === user.id ? h.user_b_id : h.user_a_id);
  }
  const freshPool = pool.filter((p: any) => !seen.has(p.id));

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

  return NextResponse.json({ roster });
}
