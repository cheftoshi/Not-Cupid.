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
import { acceptMatch, releaseTimedOutMatches } from '@/lib/match-actions';
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

  // Free the caller's own timed-out matches first (returns them to 'waiting'),
  // then block only if they still have a genuinely LIVE match.
  await releaseTimedOutMatches(user.id);

  const { data: openMatches } = await supabaseAdmin
    .from('matches')
    .select('user_1_accepted, user_2_accepted, expires_at')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .is('ended_at', null)
    .neq('status', 'expired');
  const nowCheck = Date.now();
  const hasLive = (openMatches ?? []).some((m: any) => {
    const both = m.user_1_accepted && m.user_2_accepted;
    if (both) return true;
    return !m.expires_at || new Date(m.expires_at).getTime() >= nowCheck;
  });
  if (hasLive) {
    return NextResponse.json({ error: 'You already have an active match.' }, { status: 409 });
  }

  // Load + validate the candidate (prevents picking arbitrary / ineligible ids).
  const { data: cand } = await supabaseAdmin.from('users').select('*').eq('id', candidateId).is('deleted_at', null).single();
  if (!cand) return NextResponse.json({ error: 'That person is no longer available.' }, { status: 404 });

  const nowMs = Date.now();
  const eligible =
    cand.status === 'waiting' &&
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

  // ── Atomic claim: candidate first, then self. Only succeeds if still 'waiting'.
  const { data: claimedCand } = await supabaseAdmin
    .from('users').update({ status: 'matched' }).eq('id', candidateId).eq('status', 'waiting').select('id');
  if (!claimedCand || claimedCand.length === 0) {
    return NextResponse.json({ error: 'They just got matched with someone else — pick another.' }, { status: 409 });
  }

  const { data: claimedSelf } = await supabaseAdmin
    .from('users').update({ status: 'matched' }).eq('id', user.id).eq('status', 'waiting').select('id');
  if (!claimedSelf || claimedSelf.length === 0) {
    // We grabbed the candidate but couldn't grab ourselves (cron matched us
    // first). Release the candidate so they stay available to others.
    await supabaseAdmin.from('users').update({ status: 'waiting' }).eq('id', candidateId);
    return NextResponse.json({ error: 'You just got matched — refresh to see it.' }, { status: 409 });
  }

  // Both claimed. Stamp last_matched_at + create the pending match.
  const matchedAt = new Date().toISOString();
  await supabaseAdmin.from('users').update({ last_matched_at: matchedAt }).in('id', [user.id, candidateId]);

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
