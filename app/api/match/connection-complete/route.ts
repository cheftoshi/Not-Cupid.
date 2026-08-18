import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { recordLoveConnectionPurchase } from '@/lib/love-pick-access';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  if (!user) return NextResponse.redirect(`${origin}/login?next=/dashboard`);
  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(`${origin}/dashboard?extra_connection=error#roster`);
  }
  try {
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      cache: 'no-store',
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok || session?.metadata?.user_id !== user.id) throw new Error('Checkout does not belong to this account.');
    await recordLoveConnectionPurchase(session);
    if (session.customer) {
      await supabaseAdmin.from('users').update({ stripe_customer_id: session.customer }).eq('id', user.id);
    }
    const candidateId = encodeURIComponent(session.metadata.candidate_id);
    return NextResponse.redirect(`${origin}/dashboard?extra_connection=ready&candidate=${candidateId}#roster`);
  } catch (error) {
    console.error('Love connection completion failed:', error);
    return NextResponse.redirect(`${origin}/dashboard?extra_connection=error#roster`);
  }
}
