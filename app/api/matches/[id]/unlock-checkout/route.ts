import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';
import { profileUnlockSummary } from '@/lib/profile-unlock';
import { isPro } from '@/lib/pro';
import { recordMonetizationEvent } from '@/lib/monetization';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `checkout-unlock:${user.id}`, windowSec: 600, maxAttempts: 10, blockSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many checkout attempts' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Payments unavailable' }, { status: 503 });
  if (isPro(user)) return NextResponse.json({ error: 'Your Pro membership already unlocks every Love profile.' }, { status: 409 });

  // Which tier: 'hexaco' (legacy) or 'profile' ($0.99, full profile).
  let tier: 'hexaco' | 'profile' = 'profile';
  try {
    const b = await req.json();
    if (b?.tier === 'hexaco') tier = 'hexaco';
  } catch { /* default profile */ }

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', id)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  const isUser1 = match.user_1_id === user.id;
  const isUser2 = match.user_2_id === user.id;
  if (!isUser1 && !isUser2) return NextResponse.json({ error: 'Not your match' }, { status: 403 });

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
    return NextResponse.json({ error: 'This compatibility profile is already unlocked.' }, { status: 409 });
  }

  // Sell only when there is real user-supplied profile or quiz value. This now
  // includes interests, lifestyle, values, and connection style—not only a bio
  // or gallery—so the wall matches the actual compatibility profile promised.
  const summary = profileUnlockSummary(otherUser);
  if (!summary.available) {
    return NextResponse.json(
      { error: `${otherUser?.name || 'They'} hasn't added enough profile detail to unlock yet.` },
      { status: 422 }
    );
  }
  tier = 'profile'; // never sell the standalone HEXACO tier

  const amount = '99'; // $0.99 (dropped from $1.99 on 6/21 — a profile is light info)
  const productName = `Unlock ${otherUser?.name || 'match'}'s compatibility profile`;

  // Determine origin for redirect URLs
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';

  // Create Stripe Checkout via REST API
  const body = new URLSearchParams();
  body.append('payment_method_types[]', 'card');
  body.append('mode', 'payment');
  body.append('line_items[0][quantity]', '1');
  body.append('line_items[0][price_data][currency]', 'usd');
  body.append('line_items[0][price_data][product_data][name]', productName);
  body.append('line_items[0][price_data][product_data][description]', 'Bio, extra photos, interests, lifestyle, values, and compatibility details available on this match.');
  body.append('line_items[0][price_data][unit_amount]', amount);
  body.append('client_reference_id', user.id);
  if (user.stripe_customer_id) {
    body.append('customer', user.stripe_customer_id);
  } else {
    body.append('customer_creation', 'always');
    if (user.email) body.append('customer_email', user.email);
  }
  body.append('success_url', `${origin}/dashboard?unlock_session={CHECKOUT_SESSION_ID}`);
  body.append('cancel_url', `${origin}/dashboard`);
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
