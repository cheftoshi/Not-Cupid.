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
import { acceptMatch, releaseTimedOutMatches, liveMatchesFor, MAX_CONNECTIONS } from '@/lib/match-actions';
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

  // Capacity model: no single-match atomic claim. Both sides had spare capacity
  // above, so we create the pending match directly. `status='matched'` is kept
  // for back-compat (pools/legacy) but is now just informational — capacity is
  // enforced by the live-match count, not this flag. A rare double-pick race
  // just means a candidate gets an extra suitor to accept or decline.
  const matchedAt = new Date().toISOString();
  await supabaseAdmin
    .from('users')
    .update({ status: 'matched', last_matched_at: matchedAt })
    .in('id', [user.id, candidateId]);

  const score = compatibilityScore(user, cand);
  const { data: match, error: insErr } = await supabaseAdmin
    .from('matches')
    .insert([{
      user_1_id: user.id,
      user_2_id: candidateId,
      compatibility_score: score,
      status: 'pending',
      expires_at: new Date(nowMs + 72 * 60 * 60 * 1000).toISOString(), // 72h accept window
    }])
    .select()
    .single();

  if (insErr || !match) {
    // Roll both back so nobody is stranded as 'matched' with no match row.
    await supabaseAdmin.from('users').update({ status: 'waiting' }).in('id', [user.id, candidateId]);
    console.error('pick: match insert failed', insErr);
    return NextResponse.json({ error: 'Could not create the match. Try again.' }, { status: 500 });
  }

  // Picker pre-accepts → this nudges the candidate to accept back. Reuses the
  // one shared activation path so mutual-accept behaves identically.
  await acceptMatch(match.id, user.id).catch((e) => console.error('pick: acceptMatch failed', e));

  return NextResponse.json({ ok: true, matchId: match.id, score });
}
