import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { friendCompatibilityScore, friendGenderOk } from '@/lib/friend-matching';
import { joinCircle, connectedFriendCount, FRIEND_MAX_CONNECTIONS } from '@/lib/friend-circles';
import { sendPushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Pick a friend candidate. Mutual pick (both sides) → connected + shared circle.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join the Friend Line first.' }, { status: 400 });

  const { candidateId } = await req.json().catch(() => ({}));
  if (!candidateId || candidateId === user.id) return NextResponse.json({ error: 'Invalid candidate' }, { status: 400 });

  const { data: cand } = await supabaseAdmin
    .from('users').select('*').eq('id', candidateId).is('deleted_at', null).single();
  if (!cand || !cand.friend_opted_in_at) return NextResponse.json({ error: 'They’re not available.' }, { status: 404 });
  if (!friendGenderOk(user, cand)) return NextResponse.json({ error: 'Not a match on friend preferences.' }, { status: 409 });

  // 5-max for the PICKER (we re-check the candidate only when it would become mutual).
  if ((await connectedFriendCount(user.id)) >= FRIEND_MAX_CONNECTIONS) {
    return NextResponse.json({ error: `You're at the ${FRIEND_MAX_CONNECTIONS}-friend max. Drop one to add another.` }, { status: 409 });
  }

  // Canonical ordering so a pair has one row.
  const [aId, bId] = [user.id, candidateId].sort();
  const iAmA = aId === user.id;

  const { data: existing } = await supabaseAdmin
    .from('friend_connections').select('*').eq('user_a_id', aId).eq('user_b_id', bId).maybeSingle();

  if (existing?.status === 'connected') return NextResponse.json({ ok: true, connected: true, already: true });
  if (existing?.status === 'declined') return NextResponse.json({ error: 'That connection was ended.' }, { status: 409 });

  const myPick = iAmA ? { a_picked: true } : { b_picked: true };
  const theyPicked = iAmA ? existing?.b_picked : existing?.a_picked;
  const score = friendCompatibilityScore(user, cand);
  const meFirst = (user.name || 'Someone').split(' ')[0];

  if (theyPicked) {
    // Mutual! Re-check the candidate's cap at the moment it would connect.
    if ((await connectedFriendCount(candidateId)) >= FRIEND_MAX_CONNECTIONS) {
      return NextResponse.json({ error: 'They just hit their friend max — try someone else.' }, { status: 409 });
    }
    const circleId = await joinCircle(aId, bId);
    await supabaseAdmin.from('friend_connections').upsert(
      { user_a_id: aId, user_b_id: bId, ...myPick, status: 'connected', circle_id: circleId, compatibility_score: score, connected_at: new Date().toISOString() },
      { onConflict: 'user_a_id,user_b_id' }
    );
    // They picked you earlier and you just accepted → tell them you're connected.
    await sendPushToUser(candidateId, {
      title: `you’re connected with ${meFirst} 🧡`,
      body: `${meFirst} accepted — your friend chat is open. say hi.`,
      url: '/friends?view=crew', tag: `friend-conn-${aId}-${bId}`,
    }).catch(() => {});
    return NextResponse.json({ ok: true, connected: true, circleId });
  }

  // First pick → pending. Notify the chosen person that someone selected them.
  await supabaseAdmin.from('friend_connections').upsert(
    { user_a_id: aId, user_b_id: bId, ...myPick, status: 'pending', compatibility_score: score },
    { onConflict: 'user_a_id,user_b_id' }
  );
  await sendPushToUser(candidateId, {
    title: `${meFirst} wants to connect 🧡`,
    body: `${meFirst} picked you on the Friend Line — accept to become friends.`,
    url: '/friends', tag: `friend-pick-${candidateId}`,
  }).catch(() => {});
  return NextResponse.json({ ok: true, connected: false });
}
