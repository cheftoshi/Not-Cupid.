import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isPro } from '@/lib/pro';
import PackClient from './pack-client';

export const dynamic = 'force-dynamic';

export default async function PackPage({ searchParams }: { searchParams: { bought?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/friends/pack');
  if (!user.friend_opted_in_at) redirect('/friends/quiz');

  // Returning from a $1.99 pack checkout → grant the round inline so the fresh
  // pack is ready (the webhook is the durable path). Idempotent on the payment id.
  if (searchParams.bought) {
    try {
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${searchParams.bought}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, cache: 'no-store',
      });
      const s = await r.json();
      const paid = s.payment_status === 'paid' || s.status === 'complete';
      if (paid && s.metadata?.user_id === user.id && s.metadata?.type === 'friend_more_matches') {
        await supabaseAdmin.from('friend_match_rounds').upsert(
          { user_id: user.id, stripe_payment_id: s.payment_intent },
          { onConflict: 'stripe_payment_id' }
        );
      }
    } catch (e) { console.error('Pack purchase verify failed', e); }
  }

  return <PackClient firstName={(user.name || 'friend').split(' ')[0]} pro={isPro(user)} />;
}
