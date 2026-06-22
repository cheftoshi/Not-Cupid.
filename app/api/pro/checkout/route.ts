import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { PRO_PRICE_CENTS } from '@/lib/pro';

export const dynamic = 'force-dynamic';

// NotCupid All-Access — $3.99/mo recurring. Unlocks everything: free love-profile
// unlocks, free friendship packs, events. Grant lands via the stripe-webhook
// (type=all_access → friend_pro_until), renewals + cancel already handled there.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}` || 'https://notcupid.com';
  const p = new URLSearchParams();
  p.append('payment_method_types[]', 'card');
  p.append('mode', 'subscription');
  p.append('line_items[0][quantity]', '1');
  p.append('line_items[0][price_data][currency]', 'usd');
  p.append('line_items[0][price_data][product_data][name]', 'NotCupid Pro');
  p.append('line_items[0][price_data][unit_amount]', String(PRO_PRICE_CENTS));
  p.append('line_items[0][price_data][recurring][interval]', 'month');
  if (user.email) p.append('customer_email', user.email);
  if (user.stripe_customer_id) p.append('customer', user.stripe_customer_id);
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
    return NextResponse.json({ error: session.error?.message || 'Stripe error' }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
