import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { activeCircleOf } from '@/lib/friend-circles';
import { FRIEND_CHAT_UNLOCK_CENTS, isPro } from '@/lib/friend-access';

export const dynamic = 'force-dynamic';

// Two purchase modes:
//   { tier: 'crew' } → $0.99 one-time, unlocks THIS user's current circle chat
//   { tier: 'pro' }  → $2.99/mo recurring subscription, unlocks all chats
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (isPro(user)) return NextResponse.json({ error: 'already_pro' }, { status: 400 });

  const { tier } = await req.json().catch(() => ({ tier: 'crew' }));
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}` || 'https://notcupid.com';
  const body = new URLSearchParams();
  body.append('payment_method_types[]', 'card');
  body.append('metadata[user_id]', user.id);

  if (tier === 'pro') {
    if (!process.env.STRIPE_FRIEND_PRO_PRICE_ID) {
      return NextResponse.json({ error: 'Pro plan not configured (missing STRIPE_FRIEND_PRO_PRICE_ID).' }, { status: 500 });
    }
    body.append('mode', 'subscription');
    body.append('line_items[0][price]', process.env.STRIPE_FRIEND_PRO_PRICE_ID); // recurring $2.99/mo price
    body.append('line_items[0][quantity]', '1');
    body.append('metadata[type]', 'friend_pro');
    body.append('subscription_data[metadata][user_id]', user.id);
    body.append('subscription_data[metadata][type]', 'friend_pro');
    if (user.stripe_customer_id) body.append('customer', user.stripe_customer_id);
    body.append('success_url', `${origin}/friends?pro={CHECKOUT_SESSION_ID}`);
    body.append('cancel_url', `${origin}/friends`);
  } else {
    // Per-crew $0.99 unlock — must currently be in a circle to buy.
    const circleId = await activeCircleOf(user.id);
    if (!circleId) return NextResponse.json({ error: 'You need a crew before unlocking its chat.' }, { status: 400 });
    const { data: already } = await supabaseAdmin
      .from('friend_chat_unlocks').select('circle_id').eq('user_id', user.id).eq('circle_id', circleId).maybeSingle();
    if (already) return NextResponse.json({ error: 'already_unlocked' }, { status: 400 });

    body.append('mode', 'payment');
    body.append('line_items[0][quantity]', '1');
    body.append('line_items[0][price_data][currency]', 'usd');
    body.append('line_items[0][price_data][product_data][name]', "Friend Maxxin — unlock your crew's chat");
    body.append('line_items[0][price_data][unit_amount]', String(FRIEND_CHAT_UNLOCK_CENTS));
    body.append('metadata[type]', 'friend_crew_unlock');
    body.append('metadata[circle_id]', circleId);
    body.append('success_url', `${origin}/friends?crew_unlock={CHECKOUT_SESSION_ID}`);
    body.append('cancel_url', `${origin}/friends`);
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const session = await res.json();
  if (!res.ok) {
    console.error('Friend checkout error:', session);
    return NextResponse.json({ error: session.error?.message || 'Stripe error' }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
