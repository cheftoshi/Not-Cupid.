// POST /api/match/pick   { candidateId }
//
// The caller chooses a person from their roster. Postgres locks both people and
// claims capacity/history atomically, so a simultaneous pick cannot create a
// duplicate or overflow either person's live-connection ceiling. On success we
// create a pending match with the PICKER pre-accepted and nudge the candidate
// to answer Yes or Pass (reusing the shared accept-activation flow).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  MATCHING_ALGORITHM_VERSION,
  compatibilityBreakdown,
  hasHardDealbreakerConflict,
  isGenderMatch,
  isWithinRadius,
} from '@/lib/matching';
import { intentOf } from '@/lib/pools';
import {
  acceptMatch,
  releaseTimedOutMatches,
  liveMatchesFor,
  MAX_CONNECTIONS,
  MAX_IGNORED_PICKS,
  syncMatchRosters,
} from '@/lib/match-actions';
import { DEFAULT_MATCH_RADIUS } from '@/lib/quiz-data';
import { LOVE_CONNECTION_PRICE_CENTS, LOVE_INCLUDED_PICKS, LOVE_MAX_PENDING_INCOMING } from '@/lib/matching-policy';
import { creditForCandidate, lovePickAccessFor } from '@/lib/love-pick-access';
import { ensureCompatibilityReadEntitlement } from '@/lib/love-compatibility-access';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { candidateId, preferPaid } = await req.json().catch(() => ({ candidateId: null, preferPaid: false }));
  if (!candidateId || typeof candidateId !== 'string') {
    return NextResponse.json({ error: 'candidateId required' }, { status: 400 });
  }
  if (candidateId === user.id) return NextResponse.json({ error: 'Cannot pick yourself' }, { status: 400 });
  const preservePaidCredit = async () => {
    if (preferPaid !== true) return;
    await supabaseAdmin.from('love_connection_unlocks').update({
      status: 'credit',
      intended_candidate_id: null,
    }).eq('user_id', user.id).eq('intended_candidate_id', candidateId).in('status', ['purchased', 'credit']);
  };
  const rosterSnapshot: string[] = Array.isArray(user.roster_snapshot) ? user.roster_snapshot : [];
  // A background roster verification can rotate the saved snapshot while an
  // installed PWA is still displaying the prior, genuinely-issued roster.
  // Accept a candidate we actually exposed to this user during the current
  // return window; the full eligibility checks below still prevent arbitrary
  // ids, duplicates, stale profiles, or cross-realm picks.
  let wasRecentlyExposed = false;
  if (!rosterSnapshot.includes(candidateId)) {
    const { data: exposure } = await supabaseAdmin
      .from('roster_exposures')
      .select('shown_at')
      .eq('user_id', user.id)
      .eq('candidate_id', candidateId)
      .gte('shown_at', new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString())
      .maybeSingle();
    wasRecentlyExposed = !!exposure;
  }
  if (!rosterSnapshot.includes(candidateId) && !wasRecentlyExposed) {
    await preservePaidCredit();
    return NextResponse.json({ error: 'That roster changed. We refreshed your current options.', code: 'stale_roster' }, { status: 403 });
  }

  // Ghosted/paused callers can't pick — locked out of both lines until they
  // refresh their profile (which clears the flag and starts them over).
  const callerCooldown = user.matching_cooldown_until && new Date(user.matching_cooldown_until).getTime() > Date.now();
  if (user.matching_disabled_at || callerCooldown) {
    return NextResponse.json({ error: 'Your matching is paused. Refresh your profile to start over.' }, { status: 403 });
  }

  // Free timed-out matches first. The hard cap is only a safety ceiling; the
  // actual product boundary is three included distinct picks per roster cycle,
  // then a one-time extra-connection entitlement (or Pro).
  await releaseTimedOutMatches(user.id);

  const [myLive, pickAccess] = await Promise.all([
    liveMatchesFor(user.id),
    lovePickAccessFor(user),
  ]);
  if (myLive.length >= MAX_CONNECTIONS) {
    return NextResponse.json(
      { error: `You're at the safety limit of ${MAX_CONNECTIONS} live connections. Wrap one up before starting another.` },
      { status: 409 }
    );
  }
  // Already connected with this person? (don't create a duplicate live match)
  const alreadyWith = myLive.some(
    (m: any) => m.user_1_id === candidateId || m.user_2_id === candidateId
  );
  if (alreadyWith) {
    const existing = myLive.find(
      (m: any) => m.user_1_id === candidateId || m.user_2_id === candidateId
    );
    // A weak connection may lose the original success response. Treat the
    // identical retry as success instead of making the user wonder if it worked.
    return NextResponse.json({ ok: true, matchId: existing.id, already: true });
  }

  // Load + validate the candidate (prevents picking arbitrary / ineligible ids).
  const { data: cand } = await supabaseAdmin.from('users').select('*').eq('id', candidateId).is('deleted_at', null).single();
  if (!cand) {
    await preservePaidCredit();
    return NextResponse.json({ error: 'That person is no longer available. Your extra-connection credit is saved.' }, { status: 404 });
  }

  // Candidate must have spare capacity too (they can be talking to others, just
  // not maxed out). Replaces the old single-match `status === 'waiting'` gate.
  const candLive = await liveMatchesFor(candidateId);
  const candidatePendingIncoming = candLive.filter((match: any) =>
    match.status === 'pending' && (
      (match.user_1_id === candidateId && !match.user_1_accepted && match.user_2_accepted) ||
      (match.user_2_id === candidateId && !match.user_2_accepted && match.user_1_accepted)
    )
  ).length;
  const nowMs = Date.now();
  const eligible =
    candLive.length < MAX_CONNECTIONS &&
    candidatePendingIncoming < LOVE_MAX_PENDING_INCOMING &&
    // Responsiveness gate: a chronic no-show is benched (graceful if unmigrated).
    ((cand.ignored_picks ?? 0) <= MAX_IGNORED_PICKS) &&
    // Realm segregation: test ↔ test, real ↔ real only.
    ((cand.is_test === true) === ((user as any).is_test === true)) &&
    cand.pool_active !== false &&
    !cand.matching_disabled_at &&
    (!cand.matching_cooldown_until || new Date(cand.matching_cooldown_until).getTime() < nowMs) &&
    isGenderMatch(user, cand) &&
    !hasHardDealbreakerConflict(user, cand) &&
    user.age >= cand.age_min && user.age <= cand.age_max && cand.age >= user.age_min && cand.age <= user.age_max &&
    isWithinRadius(user.zip, cand.zip, user.match_radius ?? DEFAULT_MATCH_RADIUS) &&
    // ENM cluster: enm only with enm
    (() => {
      const u = intentOf(user), c = intentOf(cand);
      if (u === 'enm' || c === 'enm') return u === 'enm' && c === 'enm';
      return true;
    })();
  if (!eligible) {
    await preservePaidCredit();
    return NextResponse.json({ error: preferPaid === true
      ? 'That person is no longer available. Your extra-connection credit is saved.'
      : 'That person is no longer available.' }, { status: 409 });
  }

  // Don't allow re-matching a prior pair.
  const [a, b] = [user.id, candidateId].sort();
  const { data: prior } = await supabaseAdmin
    .from('match_history')
    .select('match_id')
    .eq('user_a_id', a)
    .eq('user_b_id', b)
    .maybeSingle();
  if (prior) {
    await preservePaidCredit();
    return NextResponse.json({ error: preferPaid === true
      ? 'You two have already been matched before. Your extra-connection credit is saved.'
      : 'You two have already been matched before.' }, { status: 409 });
  }

  let accessType: 'included' | 'paid' | 'pro';
  let unlockId: string | null = null;
  if (pickAccess.pro) {
    accessType = 'pro';
  } else {
    const credit = creditForCandidate(pickAccess.credits, candidateId);
    if (preferPaid === true && credit) {
      accessType = 'paid';
      unlockId = credit.id;
    } else if (pickAccess.includedRemaining > 0) {
      accessType = 'included';
    } else if (credit) {
      accessType = 'paid';
      unlockId = credit.id;
    } else {
      return NextResponse.json({
        error: `You've used your ${LOVE_INCLUDED_PICKS} included picks for this roster.`,
        paywall: true,
        amountCents: LOVE_CONNECTION_PRICE_CENTS,
        candidateId,
      }, { status: 402 });
    }
  }

  // Final capacity/history claim happens inside Postgres while both user rows
  // are locked. Concurrent picks for either person serialize here, so nobody
  // can exceed the live safety ceiling and the same pair cannot be created twice.
  const breakdown = compatibilityBreakdown(user, cand);
  const score = breakdown.score;
  const { data: matchId, error: claimErr } = await supabaseAdmin.rpc('create_love_pick', {
    p_picker_id: user.id,
    p_candidate_id: candidateId,
    p_compatibility_score: score,
    p_expires_at: new Date(nowMs + 72 * 60 * 60 * 1000).toISOString(),
    p_max_connections: MAX_CONNECTIONS,
    p_access_type: accessType,
    p_unlock_id: unlockId,
  });

  if (claimErr) {
    console.error('pick: capacity claim failed', claimErr);
    return NextResponse.json({ error: 'Could not create the match. Try again.' }, { status: 500 });
  }
  if (!matchId) {
    // A purchased connection is never lost to a capacity race. Turn it into an
    // unbound credit that can be used on another current roster profile.
    if (accessType === 'paid' && unlockId) {
      await supabaseAdmin.from('love_connection_unlocks').update({
        status: 'credit',
        intended_candidate_id: null,
      }).eq('id', unlockId).eq('user_id', user.id).in('status', ['purchased', 'credit']);
    }
    return NextResponse.json(
      { error: accessType === 'paid'
        ? 'That person just became unavailable. Your $0.99 is saved as an extra-connection credit for another roster profile.'
        : 'That person just filled their available slots. Your included pick was not used.' },
      { status: 409 },
    );
  }

  if (accessType === 'paid' && unlockId) {
    await ensureCompatibilityReadEntitlement({
      userId: user.id,
      candidateId,
      connectionUnlockId: unlockId,
      rosterCycleAt: pickAccess.cycleAt,
    }).catch((error) => console.error('pick: compatibility entitlement failed', error));
  }

  // Remove this pair from each other's own roster. A person is removed from
  // everyone else's saved roster only after the safety ceiling is filled.
  await syncMatchRosters([user.id, candidateId]);

  // Persist auditable decision metadata (aggregate scores/reason codes only,
  // never raw quiz answers) and close the roster exposure → pick loop.
  const metadataResults = await Promise.all([
    supabaseAdmin.from('matches').update({
      algorithm_version: MATCHING_ALGORITHM_VERSION,
      match_score_details: {
        confidence: breakdown.confidence,
        reason_codes: breakdown.reasonCodes,
        signal_scores: breakdown.signalScores,
      },
    }).eq('id', matchId),
    supabaseAdmin.from('roster_exposures').update({
      picked_at: new Date().toISOString(),
      picked_match_id: matchId,
    }).eq('user_id', user.id).eq('candidate_id', candidateId),
  ]);
  for (const result of metadataResults) {
    if (result.error) console.error('pick: analytics metadata failed', result.error);
  }

  // Picker pre-accepts → this nudges the candidate to accept back. Reuses the
  // one shared activation path so mutual-accept behaves identically.
  await acceptMatch(matchId, user.id).catch((e) => console.error('pick: acceptMatch failed', e));

  return NextResponse.json({ ok: true, matchId, score, accessType });
}
