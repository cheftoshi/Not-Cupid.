import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    .select('name')
    .eq('id', otherUserId)
    .single();

  // Determine origin for redirect URLs
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}` || 'https://notcupid.com';

  // Create Stripe Checkout via REST API
  const body = new URLSearchParams();
  body.append('payment_method_types[]', 'card');
  body.append('mode', 'payment');
  body.append('line_items[0][quantity]', '1');
  body.append('line_items[0][price_data][currency]', 'usd');
  body.append('line_items[0][price_data][product_data][name]', `Unlock ${otherUser?.name || 'match'}'s profile`);
  body.append('line_items[0][price_data][unit_amount]', '299');
  body.append('success_url', `${origin}/dashboard?unlock_session={CHECKOUT_SESSION_ID}`);
  body.append('cancel_url', `${origin}/dashboard`);
  body.append('metadata[user_id]', user.id);
  body.append('metadata[match_id]', match.id);
  body.append('metadata[unlocked_user_id]', otherUserId);
  body.append('metadata[type]', 'match_unlock');

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
