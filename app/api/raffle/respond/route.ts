import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE } from '@/lib/raffle';
import { sendPushToUser } from '@/lib/push';
import { drawRaffle } from '@/lib/raffle-draw';

export const dynamic = 'force-dynamic';

// Accept / decline your raffle draw. Mutual accept → the $200 date is locked in
// and both sides get the details.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { accept } = await req.json().catch(() => ({ accept: false }));

  const { data: draws } = await supabaseAdmin.from('raffle_draws').select('*')
    .eq('event_key', RAFFLE.key)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq('status', 'pending').limit(1);
  const d = (draws ?? [])[0];
  if (!d) return NextResponse.json({ error: 'No pending raffle match.' }, { status: 404 });

  const isA = d.user_a_id === user.id;
  const otherId = isA ? d.user_b_id : d.user_a_id;
  const myFirst = (user.name || 'Someone').split(' ')[0];

  if (!accept) {
    // The rejecter is out of the round. The other person (who was willing) goes
    // back in the pool for a re-draw IF they're still under the attempt cap.
    await supabaseAdmin.from('raffle_draws').update({ status: 'declined' }).eq('id', d.id);
    await supabaseAdmin.from('raffle_entries').update({ status: 'passed' }).eq('event_key', RAFFLE.key).eq('user_id', user.id);

    const { data: oe } = await supabaseAdmin.from('raffle_entries').select('attempts').eq('event_key', RAFFLE.key).eq('user_id', otherId).maybeSingle();
    const otherAttempts = (oe as any)?.attempts ?? 0;
    if (otherAttempts < RAFFLE.maxAttempts) {
      await supabaseAdmin.from('raffle_entries').update({ status: 'entered' }).eq('event_key', RAFFLE.key).eq('user_id', otherId);
      await sendPushToUser(otherId, { title: 'Finding you another match…', body: `Your ${RAFFLE.series} pick passed — we're drawing you someone new.`, url: '/hub', tag: 'raffle-redraw' }).catch(() => {});
    } else {
      await supabaseAdmin.from('raffle_entries').update({ status: 'passed' }).eq('event_key', RAFFLE.key).eq('user_id', otherId);
    }
    await drawRaffle().catch((e) => console.error('redraw failed', e)); // advance to the next pair
    return NextResponse.json({ ok: true, status: 'declined' });
  }

  const bothNow = isA ? !!d.b_accepted : !!d.a_accepted; // the other side already in?
  const patch: any = isA ? { a_accepted: true } : { b_accepted: true };
  if (bothNow) { patch.status = 'both_accepted'; patch.restaurant = RAFFLE.restaurant; patch.happens_at = RAFFLE.happensAt; }
  await supabaseAdmin.from('raffle_draws').update(patch).eq('id', d.id);

  if (bothNow) {
    const msg = { title: "It's a date! ✦", body: `You + your ${RAFFLE.series} match both said yes. ${RAFFLE.dateLabel} — details on your hub.`, url: '/hub', tag: `raffle-${d.id}` };
    await Promise.allSettled([sendPushToUser(user.id, msg), sendPushToUser(otherId, msg)]);
  } else {
    await sendPushToUser(otherId, { title: `${myFirst} said yes 👀`, body: `Your ${RAFFLE.series} match accepted — say yes to lock in your $${RAFFLE.budget} date.`, url: '/hub', tag: `raffle-${d.id}` }).catch(() => {});
  }
  return NextResponse.json({ ok: true, bothAccepted: bothNow });
}
