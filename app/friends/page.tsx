import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { hasFriendVibes } from '@/lib/friend-quiz';
import { friendAccess } from '@/lib/friend-access';
import FriendHubClient from './friend-hub-client';

export const dynamic = 'force-dynamic';

export default async function FriendsHubPage({ searchParams }: { searchParams: { founded?: string } }) {
  let user = await getCurrentUser();
  if (!user) redirect('/login?next=/friends');
  if (!user.friend_opted_in_at || !hasFriendVibes(user.friend_vibes)) redirect('/friends/quiz');

  // Returning from Stripe → verify the founding payment inline + flip the flag.
  if (searchParams.founded && !user.friend_paid_at) {
    try {
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${searchParams.founded}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, cache: 'no-store',
      });
      const s = await r.json();
      if (s.payment_status === 'paid' && s.metadata?.user_id === user.id && s.metadata?.type === 'friend_founding') {
        await supabaseAdmin.from('users').update({ friend_paid_at: new Date().toISOString() }).eq('id', user.id);
        user = { ...user, friend_paid_at: new Date().toISOString() };
      }
    } catch (e) { console.error('Friend founding verify failed', e); }
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
