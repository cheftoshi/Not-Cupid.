// POST /api/match/pick   { candidateId }
//
// First-pick-wins: the caller chooses one person from their roster. We claim
// both users ATOMICALLY (conditional status update) so if someone else grabbed
// the candidate — or the cron auto-matched the caller — a split second earlier,
// this fails cleanly instead of creating a duplicate match. On success we
// create a pending match with the PICKER pre-accepted and nudge the candidate
// to accept back (reusing the shared accept-activation flow).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { compatibilityScore, isGenderMatch, isWithinRadius } from '@/lib/matching';
import { intentOf } from '@/lib/pools';
import {
  acceptMatch,
  releaseTimedOutMatches,
  liveMatchesFor,
  MAX_CONNECTIONS,
  MAX_IGNORED_PICKS,
  purgeUsersFromRosters,
} from '@/lib/match-actions';
import { DEFAULT_MATCH_RADIUS } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { candidateId } = await req.json().catch(() => ({ candidateId: null }));
  if (!candidateId || typeof candidateId !== 'string') {
    return NextResponse.json({ error: 'candidateId required' }, { status: 400 });
  }
  if (candidateId === user.id) return NextResponse.json({ error: 'Cannot pick yourself' }, { status: 400 });
  const rosterSnapshot: string[] = Array.isArray(user.roster_snapshot) ? user.roster_snapshot : [];
  if (!rosterSnapshot.includes(candidateId)) {
    return NextResponse.json({ error: 'That person is not on your current roster.' }, { status: 403 });
  }

  // Ghosted/paused callers can't pick — locked out of both lines until they
  // refresh their profile (which clears the flag and starts them over).
  const callerCooldown = user.matching_cooldown_until && new Date(user.matching_cooldown_until).getTime() > Date.now();
  if (user.matching_disabled_at || callerCooldown) {
    return NextResponse.json({ error: 'Your matching is paused. Refresh your profile to start over.' }, { status: 403 });
  }

  // Free the caller's own timed-out matches first, then enforce the CONNECTION
  // CAP: you can run up to MAX_CONNECTIONS live conversations at once (no longer
  // strictly one). Past the cap, you wrap one up before starting another.
  await releaseTimedOutMatches(user.id);

  const myLive = await liveMatchesFor(user.id);
  if (myLive.length >= MAX_CONNECTIONS) {
    return NextResponse.json(
      { error: `You're at your max of ${MAX_CONNECTIONS} conversations — wrap one up to start another.` },
      { status: 409 }
    );
  }
  // Already connected with this person? (don't create a duplicate live match)
  const alreadyWith = myLive.some(
    (m: any) => m.user_1_id === candidateId || m.user_2_id === candidateId
  );
  if (alreadyWith) {
    return NextResponse.json({ error: "You're already connected with them." }, { status: 409 });
  }

  // Load + validate the candidate (prevents picking arbitrary / ineligible ids).
  const { data: cand } = await supabaseAdmin.from('users').select('*').eq('id', candidateId).is('deleted_at', null).single();
  if (!cand) return NextResponse.json({ error: 'That person is no longer available.' }, { status: 404 });

  // Candidate must have spare capacity too (they can be talking to others, just
  // not maxed out). Replaces the old single-match `status === 'waiting'` gate.
  const candLive = await liveMatchesFor(candidateId);
  const nowMs = Date.now();
  const eligible =
    candLive.length < MAX_CONNECTIONS &&
    // Responsiveness gate: a chronic no-show is benched (graceful if unmigrated).
    ((cand.ignored_picks ?? 0) <= MAX_IGNORED_PICKS) &&
    // Realm segregation: test ↔ test, real ↔ real only.
    ((cand.is_test === true) === ((user as any).is_test === true)) &&
    cand.pool_active !== false &&
    !cand.matching_disabled_at &&
    (!cand.matching_cooldown_until || new Date(cand.matching_cooldown_until).getTime() < nowMs) &&
    isGenderMatch(user, cand) &&
    user.age >= cand.age_min && user.age <= cand.age_max && cand.age >= user.age_min && cand.age <= user.age_max &&
    isWithinRadius(user.zip, cand.zip, user.match_radius ?? DEFAULT_MATCH_RADIUS) &&
    // ENM cluster: enm only with enm
    (() => {
      const u = intentOf(user), c = intentOf(cand);
      if (u === 'enm' || c === 'enm') return u === 'enm' && c === 'enm';
      return true;
    })();
  if (!eligible) {
    return NextResponse.json({ error: 'That person is no longer available.' }, { status: 409 });
  }

  // Don't allow re-matching a prior pair.
  const [a, b] = [user.id, candidateId].sort();
  const { data: prior } = await supabaseAdmin
    .from('match_history')
    .select('match_id')
    .eq('user_a_id', a)
    .eq('user_b_id', b)
    .maybeSingle();
  if (prior) return NextResponse.json({ error: 'You two have already been matched before.' }, { status: 409 });

  // Final capacity/history claim happens inside Postgres while both user rows
  // are locked. Concurrent picks for either person serialize here, so exactly
  // one pending connection can be created and duplicate match cards cannot win
  // a race from another user's stale roster.
  const score = compatibilityScore(user, cand);
  const { data: matchId, error: claimErr } = await supabaseAdmin.rpc('create_exclusive_pending_match', {
    p_picker_id: user.id,
    p_candidate_id: candidateId,
    p_compatibility_score: score,
    p_expires_at: new Date(nowMs + 72 * 60 * 60 * 1000).toISOString(),
  });

  if (claimErr) {
    console.error('pick: exclusive claim failed', claimErr);
    return NextResponse.json({ error: 'Could not create the match. Try again.' }, { status: 500 });
  }
  if (!matchId) {
    return NextResponse.json(
      { error: 'That person just connected with someone else. Your roster has been refreshed.' },
      { status: 409 },
    );
  }

  // Remove both people from all other saved rosters before sending the nudge.
  await purgeUsersFromRosters([user.id, candidateId]);

  // Picker pre-accepts → this nudges the candidate to accept back. Reuses the
  // one shared activation path so mutual-accept behaves identically.
  await acceptMatch(matchId, user.id).catch((e) => console.error('pick: acceptMatch failed', e));

  return NextResponse.json({ ok: true, matchId, score });
}
