import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Which tier: 'hexaco' ($0.99, personality bars) or 'profile' ($1.99, full profile).
  let tier: 'hexaco' | 'profile' = 'profile';
  try {
    const b = await req.json();
    if (b?.tier === 'hexaco') tier = 'hexaco';
  } catch { /* default profile */ }

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  const isUser1 = match.user_1_id === user.id;
  const isUser2 = match.user_2_id === user.id;
  if (!isUser1 && !isUser2) return NextResponse.json({ error: 'Not your match' }, { status: 403 });

  const otherUserId = isUser1 ? match.user_2_id : match.user_1_id;
  const { data: otherUser } = await supabaseAdmin
    .from('users')
    .select('name, bio, gallery, score_honesty')
    .eq('id', otherUserId)
    .single();

  // Single wall for EVERY unlock: there must be real, user-added content
  // (bio and/or gallery). HEXACO is auto-generated and never sold on its own,
  // so we force every purchase to the $1.99 profile tier and reject when the
  // matched user hasn't actually added anything. Guards direct API hits too.
  const hasBio = !!(otherUser?.bio || '').trim();
  const hasGallery = Array.isArray(otherUser?.gallery) && otherUser!.gallery.length > 0;
  if (!hasBio && !hasGallery) {
    return NextResponse.json(
      { error: `${otherUser?.name || 'They'} hasn't added a bio or photos yet — nothing to unlock.` },
      { status: 422 }
    );
  }
  tier = 'profile'; // never sell the standalone HEXACO tier

  const amount = '199';
  const productName = `Unlock ${otherUser?.name || 'match'}'s full profile`;

  // Determine origin for redirect URLs
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}` || 'https://notcupid.com';

  // Create Stripe Checkout via REST API
  const body = new URLSearchParams();
  body.append('payment_method_types[]', 'card');
  body.append('mode', 'payment');
  body.append('line_items[0][quantity]', '1');
  body.append('line_items[0][price_data][currency]', 'usd');
  body.append('line_items[0][price_data][product_data][name]', productName);
  body.append('line_items[0][price_data][unit_amount]', amount);
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
    return NextResponse.json({ error: session.error?.message || 'Stripe error' }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
