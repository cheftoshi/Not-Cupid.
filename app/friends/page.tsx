import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { hasFriendVibes } from '@/lib/friend-quiz';
import FriendHubClient from './friend-hub-client';

export const dynamic = 'force-dynamic';

export default async function FriendsHubPage({ searchParams }: { searchParams: { crew_unlock?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/friends');
  if (!user.friend_opted_in_at || !hasFriendVibes(user.friend_vibes)) redirect('/friends/quiz');

  // Returning from a $0.99 crew-unlock checkout → record it inline so the chat
  // opens instantly (the webhook is the durable path; this avoids a wait).
  if (searchParams.crew_unlock) {
    try {
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${searchParams.crew_unlock}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, cache: 'no-store',
      });
      const s = await r.json();
      const paid = s.payment_status === 'paid' || s.status === 'complete';
      if (paid && s.metadata?.user_id === user.id && s.metadata?.type === 'friend_crew_unlock' && s.metadata?.circle_id) {
        await supabaseAdmin.from('friend_chat_unlocks').upsert(
          { user_id: user.id, circle_id: s.metadata.circle_id, stripe_payment_id: s.payment_intent },
          { onConflict: 'user_id,circle_id' }
        );
      }
    } catch (e) { console.error('Friend crew unlock verify failed', e); }
  }

  return <FriendHubClient firstName={(user.name || 'friend').split(' ')[0]} />;
}
