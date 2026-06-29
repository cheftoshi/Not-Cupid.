import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { hasFriendVibes } from '@/lib/friend-quiz';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { neighborhoodOf } from '@/lib/neighborhoods';
import FriendHubClient from './friend-hub-client';

export const dynamic = 'force-dynamic';

export default async function FriendsHubPage({ searchParams }: { searchParams: { more_matches?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/friends');
  if (!user.friend_opted_in_at || !hasFriendVibes(user.friend_vibes)) redirect('/friends/quiz');

  // Returning from a $0.99 "another round of matches" checkout → grant it inline
  // so the new matches show instantly (the webhook is the durable path). Keyed on
  // the Stripe payment id, so this and the webhook can't double-grant.
  if (searchParams.more_matches) {
    try {
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${searchParams.more_matches}`, {
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
    } catch (e) { console.error('Friend more-matches verify failed', e); }
  }

  const me = {
    name: user.name || 'you',
    photo_url: user.photo_url || null,
    archetype: user.archetype || null,
    bio: user.bio || '',
    music: user.music || [],
    food: user.food || [],
    hobbies: user.hobbies || [],
    galleryCount: Array.isArray(user.gallery) ? user.gallery.length : 0,
    // Who they set out to meet on the Friend Line — used to pre-fill an event's
    // audience so a posted event defaults to the poster's preferred range.
    friendSeeking: Array.isArray(user.friend_seeking) ? user.friend_seeking : [],
    friendAgeMin: user.friend_age_min ?? null,
    friendAgeMax: user.friend_age_max ?? null,
    // The poster's OWN gender/identity — used to constrain event audience targeting
    // (you can only restrict an event to your own gender; safety, see friend-hub).
    gender: user.gender || null,
    isLgbtq: user.is_lgbtq === true,
  };
  // Location (friends): the change-city control lives here, not on the hub.
  const metro = metroOf(user.zip);
  const city = metro && METRO_CENTERS[metro] ? `${METRO_CENTERS[metro].city}, ${METRO_CENTERS[metro].state}` : null;
  return <FriendHubClient firstName={(user.name || 'friend').split(' ')[0]} me={me} city={city} metro={metro} myArea={neighborhoodOf(user.zip)} />;
}
