import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { FRIEND_CHAT_UNLOCK_CENTS } from '@/lib/friend-access';

export const dynamic = 'force-dynamic';

// $0.99 one-time — buy ANOTHER ROUND of matches (a fresh batch of 5). Group
// chats are free; this is the only paid surface. The grant (a friend_match_rounds
// row that bumps the user's match cap) lands via the webhook and/or the
// success-redirect, idempotent on the Stripe payment id.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}` || 'https://notcupid.com';
  const params = new URLSearchParams();
  params.append('payment_method_types[]', 'card');
  params.append('mode', 'payment');
  params.append('line_items[0][quantity]', '1');
  params.append('line_items[0][price_data][currency]', 'usd');
  params.append('line_items[0][price_data][product_data][name]', 'Friend Line — another round of matches');
  params.append('line_items[0][price_data][unit_amount]', String(FRIEND_CHAT_UNLOCK_CENTS));
  params.append('metadata[user_id]', user.id);
  params.append('metadata[type]', 'friend_more_matches');
  params.append('success_url', `${origin}/friends?more_matches={CHECKOUT_SESSION_ID}`);
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
