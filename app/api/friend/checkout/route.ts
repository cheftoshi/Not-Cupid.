import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isPro } from '@/lib/friend-access';

export const dynamic = 'force-dynamic';

// Pro subscription only ($2.99/mo). The first crew's chat is free; Pro unlocks
// every additional crew. (There is no per-crew one-time purchase anymore.)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (isPro(user)) return NextResponse.json({ error: 'already_pro' }, { status: 400 });
  if (!process.env.STRIPE_FRIEND_PRO_PRICE_ID) {
    return NextResponse.json({ error: 'Pro plan not configured (missing STRIPE_FRIEND_PRO_PRICE_ID).' }, { status: 500 });
  }

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}` || 'https://notcupid.com';
  const body = new URLSearchParams();
  body.append('payment_method_types[]', 'card');
  body.append('mode', 'subscription');
  body.append('line_items[0][price]', process.env.STRIPE_FRIEND_PRO_PRICE_ID); // recurring $2.99/mo
  body.append('line_items[0][quantity]', '1');
  body.append('metadata[user_id]', user.id);
  body.append('metadata[type]', 'friend_pro');
  body.append('subscription_data[metadata][user_id]', user.id);
  body.append('subscription_data[metadata][type]', 'friend_pro');
  if (user.stripe_customer_id) body.append('customer', user.stripe_customer_id);
  body.append('success_url', `${origin}/friends?pro={CHECKOUT_SESSION_ID}`);
  body.append('cancel_url', `${origin}/friends`);

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
