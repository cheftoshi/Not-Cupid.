import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { PRO_PRICE_CENTS, isPro } from '@/lib/pro';
import { rateLimit } from '@/lib/rate-limit';
import { recordMonetizationEvent } from '@/lib/monetization';

export const dynamic = 'force-dynamic';

// NotCupid Pro — $3.99/mo recurring. Covers AI Compatibility Reads, extra Love
// connection picks, and additional Friend packs. Grant lands via the stripe-webhook
// (type=all_access → friend_pro_until), renewals + cancel already handled there.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((user as any).is_test === true) return NextResponse.json({ error: 'Payments are disabled for test accounts.' }, { status: 403 });
  if (isPro(user)) return NextResponse.json({ error: 'Your Pro membership is already active.' }, { status: 409 });
  const limit = await rateLimit({ key: `checkout-pro:${user.id}`, windowSec: 600, maxAttempts: 10, blockSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many checkout attempts' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Payments unavailable' }, { status: 503 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const p = new URLSearchParams();
  p.append('payment_method_types[]', 'card');
  p.append('mode', 'subscription');
  p.append('line_items[0][quantity]', '1');
  p.append('line_items[0][price_data][currency]', 'usd');
  p.append('line_items[0][price_data][product_data][name]', 'NotCupid Pro');
  p.append('line_items[0][price_data][product_data][description]', 'AI Compatibility Reads, extra Love connection picks, and unlimited additional Friend packs. Core profiles, accepting, replies, and plans remain free.');
  p.append('line_items[0][price_data][unit_amount]', String(PRO_PRICE_CENTS));
  p.append('line_items[0][price_data][recurring][interval]', 'month');
  // Stripe accepts an existing customer OR customer_email, not both. Existing
  // customers also get their saved details prefilled for a faster checkout.
  if (user.stripe_customer_id) p.append('customer', user.stripe_customer_id);
  else if (user.email) p.append('customer_email', user.email);
  p.append('client_reference_id', user.id);
  p.append('metadata[type]', 'all_access');
  p.append('metadata[user_id]', user.id);
  // metadata also goes on the subscription so future invoice events can resolve it.
  p.append('subscription_data[metadata][type]', 'all_access');
  p.append('subscription_data[metadata][user_id]', user.id);
  p.append('success_url', `${origin}/hub?pro=1`);
  p.append('cancel_url', `${origin}/pro`);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: p.toString(),
  });
  const session = await res.json();
  if (!res.ok) {
    console.error('All-Access checkout error:', session);
    await recordMonetizationEvent({
      userId: user.id, event: 'checkout_failed', product: 'pro', surface: 'pro_checkout_api',
      amountCents: PRO_PRICE_CENTS, metadata: { provider_status: res.status },
    });
    return NextResponse.json({ error: 'Could not create checkout' }, { status: 502 });
  }
  await recordMonetizationEvent({
    userId: user.id, event: 'checkout_started', product: 'pro', surface: 'pro_checkout_api',
    amountCents: PRO_PRICE_CENTS,
  });
  return NextResponse.json({ url: session.url });
}
