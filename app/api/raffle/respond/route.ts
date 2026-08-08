import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE } from '@/lib/raffle';
import { sendPushToUser } from '@/lib/push';
import { drawRaffle } from '@/lib/raffle-draw';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Accept or privately pass on a Dating Experiment selection.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `raffle-response:${user.id}`, windowSec: 3600, maxAttempts: 10, blockSec: 1800 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  const { accept } = await req.json().catch(() => ({ accept: false }));

  const { data: draws } = await supabaseAdmin.from('raffle_draws').select('*')
    .eq('event_key', RAFFLE.key)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq('status', 'pending').limit(1);
  const d = (draws ?? [])[0];
  if (!d) return NextResponse.json({ error: 'No pending experiment selection.' }, { status: 404 });

  const isA = d.user_a_id === user.id;
  const otherId = isA ? d.user_b_id : d.user_a_id;
  const myFirst = (user.name || 'Someone').split(' ')[0];

  if (accept && (isA ? d.a_accepted : d.b_accepted)) {
    return NextResponse.json({ ok: true, bothAccepted: false, already: true });
  }

  if (!accept) {
    // The rejecter is out of the round. The other person (who was willing) goes
    // back in the pool for a re-draw IF they're still under the attempt cap.
    const { data: declined } = await supabaseAdmin.from('raffle_draws')
      .update({ status: 'declined' })
      .eq('id', d.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (!declined) return NextResponse.json({ ok: true, status: 'already-closed' });
    await supabaseAdmin.from('raffle_entries').update({ status: 'passed' }).eq('event_key', RAFFLE.key).eq('user_id', user.id);

    const { data: oe } = await supabaseAdmin.from('raffle_entries').select('attempts').eq('event_key', RAFFLE.key).eq('user_id', otherId).maybeSingle();
    const otherAttempts = (oe as any)?.attempts ?? 0;
    if (otherAttempts < RAFFLE.maxAttempts) {
      await supabaseAdmin.from('raffle_entries').update({ status: 'entered' }).eq('event_key', RAFFLE.key).eq('user_id', otherId);
      await sendPushToUser(otherId, { title: 'We’re finding another fit…', body: 'This private pairing did not move forward. You’re back in the experiment pool.', url: '/dating-experiment', tag: 'dating-experiment-reselect' }).catch(() => {});
    } else {
      await supabaseAdmin.from('raffle_entries').update({ status: 'passed' }).eq('event_key', RAFFLE.key).eq('user_id', otherId);
    }
    await drawRaffle().catch((e) => console.error('redraw failed', e)); // advance to the next pair
    return NextResponse.json({ ok: true, status: 'declined' });
  }

  const patch: any = isA ? { a_accepted: true } : { b_accepted: true };
  await supabaseAdmin.from('raffle_draws').update(patch).eq('id', d.id).eq('status', 'pending');
  const { data: current } = await supabaseAdmin.from('raffle_draws')
    .select('a_accepted, b_accepted, status')
    .eq('id', d.id)
    .single();
  const bothNow = current?.status === 'both_accepted' || (!!current?.a_accepted && !!current?.b_accepted);
  let claimedMutual = false;
  if (bothNow && current?.status === 'pending') {
    const { data: claimed } = await supabaseAdmin.from('raffle_draws')
      .update({ status: 'both_accepted', restaurant: RAFFLE.restaurant, happens_at: RAFFLE.happensAt })
      .eq('id', d.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    claimedMutual = !!claimed;
  }

  if (claimedMutual) {
    const msg = { title: "It's a date! ✦", body: `You both said yes. ${RAFFLE.dateLabel} — open the Dating Experiment for the dinner details.`, url: '/dating-experiment', tag: `dating-experiment-${d.id}` };
    await Promise.allSettled([sendPushToUser(user.id, msg), sendPushToUser(otherId, msg)]);
  } else if (!bothNow) {
    await sendPushToUser(otherId, { title: `${myFirst} said yes 👀`, body: `Open the Dating Experiment to privately decide whether to lock in the $${RAFFLE.budget} dinner.`, url: '/dating-experiment', tag: `dating-experiment-${d.id}` }).catch(() => {});
  }
  return NextResponse.json({ ok: true, bothAccepted: bothNow });
}
