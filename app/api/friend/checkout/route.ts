import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { FRIEND_PACK_CENTS } from '@/lib/friend-access';

export const dynamic = 'force-dynamic';

// $1.99 one-time — open ANOTHER FRIENDSHIP PACK (a fresh batch of up to 10
// friends). Group chats are free; this is the only paid friend surface (free for
// All-Access). The grant (a friend_match_rounds row that bumps the match cap)
// lands via the webhook and/or the success-redirect, idempotent on the payment id.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}` || 'https://notcupid.com';
  const params = new URLSearchParams();
  params.append('payment_method_types[]', 'card');
  params.append('mode', 'payment');
  params.append('line_items[0][quantity]', '1');
  params.append('line_items[0][price_data][currency]', 'usd');
  params.append('line_items[0][price_data][product_data][name]', 'Friend Line — a new friendship pack (up to 10 friends)');
  params.append('line_items[0][price_data][unit_amount]', String(FRIEND_PACK_CENTS));
  params.append('metadata[user_id]', user.id);
  params.append('metadata[type]', 'friend_more_matches');
  params.append('success_url', `${origin}/friends/pack?bought={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${origin}/friends`);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const session = await res.json();
  if (!res.ok) {
    console.error('Friend more-matches checkout error:', session);
    return NextResponse.json({ error: session.error?.message || 'Stripe error' }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
