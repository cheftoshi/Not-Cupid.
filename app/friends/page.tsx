import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { hasFriendVibes } from '@/lib/friend-quiz';
import { friendAccess } from '@/lib/friend-access';
import FriendHubClient from './friend-hub-client';

export const dynamic = 'force-dynamic';

export default async function FriendsHubPage({ searchParams }: { searchParams: { pro?: string } }) {
  let user = await getCurrentUser();
  if (!user) redirect('/login?next=/friends');
  if (!user.friend_opted_in_at || !hasFriendVibes(user.friend_vibes)) redirect('/friends/quiz');

  // Returning from Stripe Pro checkout → verify inline so access is instant
  // (the webhook is the durable path; this just avoids a wait).
  if (searchParams.pro) {
    try {
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${searchParams.pro}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, cache: 'no-store',
      });
      const s = await r.json();
      const paid = s.payment_status === 'paid' || s.status === 'complete';
      if (paid && s.metadata?.user_id === user.id && s.metadata?.type === 'friend_pro') {
        const until = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin.from('users').update({
          friend_pro_until: until, stripe_customer_id: s.customer || null, friend_sub_id: s.subscription || null,
        }).eq('id', user.id);
        user = { ...user, friend_pro_until: until };
      }
    } catch (e) { console.error('Friend Pro verify failed', e); }
  }

  const access = friendAccess(user);
  return (
    <FriendHubClient
      firstName={(user.name || 'friend').split(' ')[0]}
      accessTier={access.tier}
      daysLeft={access.daysLeft}
    />
  );
}
