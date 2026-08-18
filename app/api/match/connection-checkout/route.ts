import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase';
import { sameRealm } from '@/lib/realm';
import { LOVE_CONNECTION_PRICE_CENTS } from '@/lib/matching-policy';
import { creditForCandidate, lovePickAccessFor } from '@/lib/love-pick-access';
import { recordMonetizationEvent } from '@/lib/monetization';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((user as any).is_test === true) {
    return NextResponse.json({ error: 'Payments are disabled for test accounts.' }, { status: 403 });
  }
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Payments unavailable' }, { status: 503 });
  const limit = await rateLimit({ key: `checkout-love-connection:${user.id}`, windowSec: 600, maxAttempts: 10, blockSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many checkout attempts' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });

  const { candidateId } = await req.json().catch(() => ({ candidateId: null }));
  if (typeof candidateId !== 'string' || !candidateId || candidateId === user.id) {
    return NextResponse.json({ error: 'Choose a valid roster profile.' }, { status: 400 });
  }
  const snapshot = Array.isArray(user.roster_snapshot) ? user.roster_snapshot : [];
  if (!snapshot.includes(candidateId)) {
    return NextResponse.json({ error: 'That person is not on your current roster.' }, { status: 403 });
  }

  const [{ data: candidate }, access] = await Promise.all([
    supabaseAdmin.from('users').select('id, name, is_test, deleted_at').eq('id', candidateId).maybeSingle(),
    lovePickAccessFor(user),
  ]);
  if (!candidate || candidate.deleted_at || !sameRealm(user, candidate)) {
    return NextResponse.json({ error: 'That person is no longer available.' }, { status: 409 });
  }
  if (access.pro) return NextResponse.json({ error: 'Pro already includes extra Love connections.' }, { status: 409 });
  if (access.includedRemaining > 0) {
    return NextResponse.json({ error: `You still have ${access.includedRemaining} included ${access.includedRemaining === 1 ? 'pick' : 'picks'} in this roster.` }, { status: 409 });
  }
  const credit = creditForCandidate(access.credits, candidateId);
  if (credit) return NextResponse.json({ creditReady: true });

  const first = String(candidate.name || 'this person').split(' ')[0].slice(0, 60);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const body = new URLSearchParams();
  body.append('payment_method_types[]', 'card');
  body.append('mode', 'payment');
  body.append('line_items[0][quantity]', '1');
  body.append('line_items[0][price_data][currency]', 'usd');
  body.append('line_items[0][price_data][product_data][name]', `${first} — extra Love connection`);
  body.append('line_items[0][price_data][product_data][description]', 'One-time extra connection pick. Their profile stays free. If mutual, chat is included. If they decline or the request expires first, the purchase returns as an in-app credit.');
  body.append('line_items[0][price_data][unit_amount]', String(LOVE_CONNECTION_PRICE_CENTS));
  body.append('client_reference_id', user.id);
  if (user.stripe_customer_id) body.append('customer', user.stripe_customer_id);
  else {
    body.append('customer_creation', 'always');
    if (user.email) body.append('customer_email', user.email);
  }
  body.append('success_url', `${origin}/api/match/connection-complete?session_id={CHECKOUT_SESSION_ID}`);
  body.append('cancel_url', `${origin}/dashboard#roster`);
  body.append('metadata[type]', 'love_connection');
  body.append('metadata[user_id]', user.id);
  body.append('metadata[candidate_id]', candidateId);
  body.append('metadata[roster_cycle_at]', access.cycleAt);

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const session = await stripeRes.json();
  if (!stripeRes.ok || typeof session?.url !== 'string') {
    console.error('Love connection checkout error:', session);
    await recordMonetizationEvent({
      userId: user.id,
      event: 'checkout_failed',
      product: 'love_connection',
      surface: 'love_connection_checkout',
      amountCents: LOVE_CONNECTION_PRICE_CENTS,
      metadata: { provider_status: stripeRes.status },
    });
    return NextResponse.json({ error: 'Could not open checkout.' }, { status: 502 });
  }
  await recordMonetizationEvent({
    userId: user.id,
    event: 'checkout_started',
    product: 'love_connection',
    surface: 'love_connection_checkout',
    amountCents: LOVE_CONNECTION_PRICE_CENTS,
  });
  return NextResponse.json({ url: session.url });
}
