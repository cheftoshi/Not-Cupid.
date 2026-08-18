import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';
import { loveDeepDiveSummary } from '@/lib/love-deep-dive';
import { isPro } from '@/lib/pro';
import { recordMonetizationEvent } from '@/lib/monetization';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((user as any).is_test === true) return NextResponse.json({ error: 'Payments are disabled for test accounts.' }, { status: 403 });
  const limit = await rateLimit({ key: `checkout-unlock:${user.id}`, windowSec: 600, maxAttempts: 10, blockSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many checkout attempts' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Payments unavailable' }, { status: 503 });
  if (isPro(user)) return NextResponse.json({ error: 'Your Pro membership already opens every compatibility deep-dive.' }, { status: 409 });

  // `profile` is the legacy database tier name for the $0.99 deep-dive.
  // The old standalone HEXACO product is no longer sold.
  const tier = 'profile' as const;

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, status, ended_at')
    .eq('id', id)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  const isUser1 = match.user_1_id === user.id;
  const isUser2 = match.user_2_id === user.id;
  if (!isUser1 && !isUser2) return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  if (match.ended_at || ['ended', 'passed', 'expired'].includes(match.status)) {
    return NextResponse.json({ error: 'This connection has ended.' }, { status: 409 });
  }
  if (!match.user_1_accepted || !match.user_2_accepted) {
    return NextResponse.json({ error: 'The compatibility deep-dive opens after you both connect.' }, { status: 409 });
  }

  const otherUserId = isUser1 ? match.user_2_id : match.user_1_id;
  const [{ data: otherUser }, { data: existingUnlock }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('name, bio, gallery, music, food, hobbies, sports, prompts, vibes, values_profile, relationship_style, attach_style')
      .eq('id', otherUserId)
      .single(),
    supabaseAdmin
      .from('match_unlocks')
      .select('profile_unlocked')
      .eq('user_id', user.id)
      .eq('match_id', match.id)
      .maybeSingle(),
  ]);

  if (existingUnlock?.profile_unlocked) {
    return NextResponse.json({ error: 'This compatibility deep-dive is already open.' }, { status: 409 });
  }

  // Sell only a real deep-dive. Bio, interests and prompts are free once the
  // users match; the purchase covers extra photos and deeper quiz context.
  const summary = loveDeepDiveSummary(otherUser);
  if (!summary.available) {
    return NextResponse.json(
      { error: `${otherUser?.name || 'They'} hasn't shared enough deep-dive detail yet.` },
      { status: 422 }
    );
  }
  const amount = '99';
  const productName = `${otherUser?.name || 'Match'} — compatibility deep-dive`;

  // Determine origin for redirect URLs
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';

  // Create Stripe Checkout via REST API
  const body = new URLSearchParams();
  body.append('payment_method_types[]', 'card');
  body.append('mode', 'payment');
  body.append('line_items[0][quantity]', '1');
  body.append('line_items[0][price_data][currency]', 'usd');
  body.append('line_items[0][price_data][product_data][name]', productName);
  body.append('line_items[0][price_data][product_data][description]', 'Extra photos, lifestyle rhythm, values, connection style, and compatibility details available on this match.');
  body.append('line_items[0][price_data][unit_amount]', amount);
  body.append('client_reference_id', user.id);
  if (user.stripe_customer_id) {
    body.append('customer', user.stripe_customer_id);
  } else {
    body.append('customer_creation', 'always');
    if (user.email) body.append('customer_email', user.email);
  }
  body.append('success_url', `${origin}/match/${match.id}?unlock_session={CHECKOUT_SESSION_ID}`);
  body.append('cancel_url', `${origin}/match/${match.id}#full-profile`);
  body.append('metadata[user_id]', user.id);
  body.append('metadata[match_id]', match.id);
  body.append('metadata[unlocked_user_id]', otherUserId);
  body.append('metadata[type]', 'match_unlock');
  body.append('metadata[unlock_tier]', tier);

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const session = await stripeRes.json();

  if (!stripeRes.ok) {
    console.error('Stripe error:', session);
    await recordMonetizationEvent({
      userId: user.id,
      event: 'checkout_failed',
      product: 'love_profile',
      surface: 'love_unlock_api',
      matchId: match.id,
      amountCents: 99,
      metadata: { provider_status: stripeRes.status },
    });
    return NextResponse.json({ error: 'Could not create checkout' }, { status: 502 });
  }

  await recordMonetizationEvent({
    userId: user.id,
    event: 'checkout_started',
    product: 'love_profile',
    surface: 'love_unlock_api',
    matchId: match.id,
    amountCents: 99,
  });

  return NextResponse.json({ url: session.url });
}
