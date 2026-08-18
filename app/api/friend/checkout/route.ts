import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { FRIEND_PACK_CENTS } from '@/lib/friend-access';
import { rateLimit } from '@/lib/rate-limit';
import { recordMonetizationEvent } from '@/lib/monetization';
import { isPro } from '@/lib/pro';

export const dynamic = 'force-dynamic';

// $0.99 one-time — open ANOTHER WEEKLY FRIENDSHIP PACK (a fresh batch of up to 5
// friends). Group chats are free; this is the only paid friend surface (free for
// All-Access). The grant (a friend_match_rounds row that bumps the match cap)
// lands via the webhook and/or the success-redirect, idempotent on the payment id.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((user as any).is_test === true) return NextResponse.json({ error: 'Payments are disabled for test accounts.' }, { status: 403 });
  if (isPro(user)) return NextResponse.json({ error: 'Your Pro membership already includes additional Friend packs.' }, { status: 409 });
  const limit = await rateLimit({ key: `checkout-friend:${user.id}`, windowSec: 600, maxAttempts: 10, blockSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many checkout attempts' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Payments unavailable' }, { status: 503 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const params = new URLSearchParams();
  params.append('payment_method_types[]', 'card');
  params.append('mode', 'payment');
  params.append('line_items[0][quantity]', '1');
  params.append('line_items[0][price_data][currency]', 'usd');
  params.append('line_items[0][price_data][product_data][name]', 'Friend Line — weekly friendship pack (up to 5 friends)');
  params.append('line_items[0][price_data][unit_amount]', String(FRIEND_PACK_CENTS));
  params.append('client_reference_id', user.id);
  if (user.stripe_customer_id) {
    params.append('customer', user.stripe_customer_id);
  } else {
    params.append('customer_creation', 'always');
    if (user.email) params.append('customer_email', user.email);
  }
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
    await recordMonetizationEvent({
      userId: user.id, event: 'checkout_failed', product: 'friend_pack', surface: 'friend_pack_checkout_api',
      amountCents: FRIEND_PACK_CENTS, metadata: { provider_status: res.status },
    });
    return NextResponse.json({ error: 'Could not create checkout' }, { status: 502 });
  }
  await recordMonetizationEvent({
    userId: user.id, event: 'checkout_started', product: 'friend_pack', surface: 'friend_pack_checkout_api',
    amountCents: FRIEND_PACK_CENTS,
  });
  return NextResponse.json({ url: session.url });
}
