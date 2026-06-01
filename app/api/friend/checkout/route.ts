import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { FRIEND_FOUNDING_PRICE_CENTS } from '@/lib/friend-access';

export const dynamic = 'force-dynamic';

// Stripe Checkout for the $2.99 Friend Maxxin founding membership (one-time).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.friend_paid_at) return NextResponse.json({ error: 'already_founding' }, { status: 400 });

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}` || 'https://notcupid.com';
  const body = new URLSearchParams();
  body.append('payment_method_types[]', 'card');
  body.append('mode', 'payment');
  body.append('line_items[0][quantity]', '1');
  body.append('line_items[0][price_data][currency]', 'usd');
  body.append('line_items[0][price_data][product_data][name]', 'Friend Maxxin — Founding Member');
  body.append('line_items[0][price_data][unit_amount]', String(FRIEND_FOUNDING_PRICE_CENTS));
  body.append('success_url', `${origin}/friends?founded={CHECKOUT_SESSION_ID}`);
  body.append('cancel_url', `${origin}/friends`);
  body.append('metadata[user_id]', user.id);
  body.append('metadata[type]', 'friend_founding');

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const session = await res.json();
  if (!res.ok) {
    console.error('Friend founding checkout error:', session);
    return NextResponse.json({ error: session.error?.message || 'Stripe error' }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
