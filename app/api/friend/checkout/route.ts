import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { activeCircleOf } from '@/lib/friend-circles';
import { FRIEND_CHAT_UNLOCK_CENTS, hasCircleAccess } from '@/lib/friend-access';

export const dynamic = 'force-dynamic';

// $0.99 one-time unlock for an additional crew's chat (the first crew is free).
// Optionally targets a specific circleId; defaults to the caller's current circle.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const circleId = (body.circleId as string) || (await activeCircleOf(user.id));
  if (!circleId) return NextResponse.json({ error: 'You need a crew before unlocking its chat.' }, { status: 400 });

  if (await hasCircleAccess(user, circleId)) {
    return NextResponse.json({ error: 'already_unlocked' }, { status: 400 });
  }

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}` || 'https://notcupid.com';
  const params = new URLSearchParams();
  params.append('payment_method_types[]', 'card');
  params.append('mode', 'payment');
  params.append('line_items[0][quantity]', '1');
  params.append('line_items[0][price_data][currency]', 'usd');
  params.append('line_items[0][price_data][product_data][name]', "Friend Maxxin — unlock a crew's chat");
  params.append('line_items[0][price_data][unit_amount]', String(FRIEND_CHAT_UNLOCK_CENTS));
  params.append('metadata[user_id]', user.id);
  params.append('metadata[type]', 'friend_crew_unlock');
  params.append('metadata[circle_id]', circleId);
  params.append('success_url', `${origin}/friends?crew_unlock={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${origin}/friends`);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const session = await res.json();
  if (!res.ok) {
    console.error('Friend crew unlock checkout error:', session);
    return NextResponse.json({ error: session.error?.message || 'Stripe error' }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
