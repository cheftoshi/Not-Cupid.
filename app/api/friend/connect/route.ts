import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { friendCompatibilityScore, friendGenderOk } from '@/lib/friend-matching';
import { sendPushToUser } from '@/lib/push';
import { rateLimit } from '@/lib/rate-limit';
import { sameRealm } from '@/lib/realm';

export const dynamic = 'force-dynamic';

// Pick a friend candidate. Mutual pick (both sides) → connected + shared circle.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join the Friend Line first.' }, { status: 400 });
  const limit = await rateLimit({ key: `friend-connect:${user.id}`, windowSec: 3600, maxAttempts: 30, blockSec: 1800 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many connection attempts' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });

  const { candidateId } = await req.json().catch(() => ({}));
  if (!candidateId || candidateId === user.id) return NextResponse.json({ error: 'Invalid candidate' }, { status: 400 });

  const { data: cand, error: candidateError } = await supabaseAdmin
    .from('users').select('*').eq('id', candidateId).is('deleted_at', null).neq('is_blocked', true).single();
  if (candidateError && candidateError.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Could not check that profile. Please retry.' }, { status: 503 });
  }
  if (!cand || !cand.friend_opted_in_at) return NextResponse.json({ error: 'They’re not available.' }, { status: 404 });
  if (!sameRealm(user, cand)) return NextResponse.json({ error: 'They’re not available.' }, { status: 404 });
  if (!friendGenderOk(user, cand)) return NextResponse.json({ error: 'Not a match on friend preferences.' }, { status: 409 });

  // CONNECTIONS ARE UNLIMITED — packs limit how many people you SEE (paced
  // discovery), never how many friends you make. No connection cap here.

  // Canonical ordering so a pair has one row.
  const [aId, bId] = [user.id, candidateId].sort();

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('friend_connections').select('*').eq('user_a_id', aId).eq('user_b_id', bId).maybeSingle();
  if (existingError) return NextResponse.json({ error: 'Could not load that connection. Please retry.' }, { status: 503 });

  // A candidate must have been assigned into this user's paced friend pack.
  // Otherwise an authenticated caller could enumerate users and manufacture
  // arbitrary connection requests/push notifications.
  if (!existing) return NextResponse.json({ error: 'That person is not in your current pack.' }, { status: 403 });
  const score = friendCompatibilityScore(user, cand);
  const meFirst = (user.name || 'Someone').split(' ')[0];
  const { data: transitionData, error: transitionError } = await supabaseAdmin.rpc('pick_friend_connection', {
    p_user_id: user.id,
    p_candidate_id: candidateId,
    p_compatibility_score: score,
  });
  if (transitionError) return NextResponse.json({ error: 'Could not send that connection. Please retry.' }, { status: 503 });
  const transition = (Array.isArray(transitionData) ? transitionData[0] : transitionData) as {
    outcome?: string;
    circle_id?: string | null;
  } | null;
  if (!transition || transition.outcome === 'not_found') {
    return NextResponse.json({ error: 'That person is not in your current pack.' }, { status: 403 });
  }
  if (transition.outcome === 'declined') return NextResponse.json({ error: 'That connection was ended.' }, { status: 409 });
  if (transition.outcome === 'expired') return NextResponse.json({ error: 'That travel introduction has ended.' }, { status: 409 });
  if (transition.outcome === 'already_pending') return NextResponse.json({ ok: true, connected: false, already: true });

  if (transition.outcome === 'connected') {
    // They picked you earlier and you just accepted → tell them you're connected.
    if (existing.status !== 'connected') {
      await sendPushToUser(candidateId, {
        title: `you’re connected with ${meFirst} 🧡`,
        body: `${meFirst} accepted — your friend chat is open. say hi.`,
        url: '/friends?view=crew', tag: `friend-conn-${aId}-${bId}`,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, connected: true, circleId: transition.circle_id, already: existing.status === 'connected' });
  }

  // First pick → pending. Notify the chosen person that someone selected them.
  await sendPushToUser(candidateId, {
    title: `${meFirst} wants to connect 🧡`,
    body: `${meFirst} picked you on the Friend Line — accept to become friends.`,
    url: '/friends', tag: `friend-pick-${candidateId}`,
  }).catch(() => {});
  return NextResponse.json({ ok: true, connected: false });
}
