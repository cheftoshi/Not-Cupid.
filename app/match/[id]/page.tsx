import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import ChatRoom from './chat-room';
import { isPro } from '@/lib/pro';
import { freeLoveProfileView, loveDeepDiveSummary } from '@/lib/love-deep-dive';
import { recordMonetizationEvent } from '@/lib/monetization';
import { sameRealm } from '@/lib/realm';
import { withPrivateVideoPreview } from '@/lib/private-media';
import { attachStyle } from '@/lib/quiz-data';
import { recordUnlock } from '@/lib/record-unlock';

export const dynamic = 'force-dynamic';

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ unlock_session?: string; deep_dive?: string }>;
}) {
  const { id } = await params;
  const { unlock_session: unlockSession, deep_dive: deepDive } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/');

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', id)
    .single();

  if (!match) redirect('/dashboard');
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) redirect('/dashboard');
  // Open the chat for any non-ended match the user is part of — including a
  // PENDING one. Sending a message here auto-accepts (see /api/messages), so an
  // opener / first reply starts the chat without a separate accept step.
  // ENDED/expired matches are still READABLE (read-only) so people can revisit a
  // past conversation instead of losing it.
  const readOnly = !!match.ended_at || ['ended', 'passed', 'expired'].includes(match.status);
  const mutuallyConnected = !!match.user_1_accepted && !!match.user_2_accepted;

  const otherId = match.user_1_id === user.id ? match.user_2_id : match.user_1_id;
  let unlockVerified = false;
  if (unlockSession && mutuallyConnected && !readOnly) {
    try {
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(unlockSession)}`,
        { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, cache: 'no-store' }
      );
      const session = await stripeRes.json();
      if (
        session.payment_status === 'paid' &&
        session.metadata?.user_id === user.id &&
        session.metadata?.match_id === id &&
        session.metadata?.type === 'match_unlock'
      ) {
        const error = await recordUnlock({
          userId: user.id,
          matchId: id,
          unlockedUserId: otherId,
          tier: 'profile',
          paymentId: session.payment_intent,
        });
        unlockVerified = !error;
      }
    } catch (error) {
      console.error('Deep-dive verification failed:', error);
    }
  }
  if (unlockVerified) redirect(`/match/${id}?deep_dive=opened`);

  const [{ data: otherUser }, { data: unlock }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, name, age, photo_url, gallery, bio, archetype, occupation, education, music, food, hobbies, sports, prompts, vibes, values_profile, attach_anxiety, attach_avoidance, attach_style, relationship_style, sun_sign, intro_video_url, is_test')
      .eq('id', otherId)
      .single(),
    supabaseAdmin
      .from('match_unlocks')
      .select('profile_unlocked')
      .eq('user_id', user.id)
      .eq('match_id', id)
      .maybeSingle(),
  ]);

  if (!otherUser || !sameRealm(user, otherUser)) redirect('/dashboard');
  // `profile_unlocked` is the legacy database column name. The entitlement is
  // now a compatibility deep-dive, and it never reveals before a mutual yes.
  const profileUnlocked = mutuallyConnected && (isPro(user) || !!unlock?.profile_unlocked);
  const unlockSummary = loveDeepDiveSummary(otherUser);
  const unlockAvailable = mutuallyConnected && !readOnly && unlockSummary.available;
  if (!profileUnlocked && unlockAvailable && !(user as any).is_test) {
    await recordMonetizationEvent({
      userId: user.id,
      event: 'paywall_viewed',
      product: 'love_profile',
      surface: 'match_room',
      matchId: id,
      amountCents: 99,
    });
  }
  const calibratedOtherUser = typeof otherUser.attach_anxiety === 'number' && typeof otherUser.attach_avoidance === 'number'
    ? { ...otherUser, attach_style: attachStyle(otherUser.attach_anxiety, otherUser.attach_avoidance) }
    : otherUser;
  const otherWithVideo = await withPrivateVideoPreview(calibratedOtherUser);
  // Pass only the short-lived playback URL to the client, never the stable
  // private-storage reference. The hello video is free inside a real match;
  // the paid profile still covers the deeper bio/gallery/compatibility story.
  const safeOtherUser = { ...otherWithVideo, intro_video_url: null };
  const visibleOtherUser = profileUnlocked ? safeOtherUser : freeLoveProfileView(safeOtherUser);

  // Last 500 messages (newest-first, then re-ordered) — enough for any real
  // conversation without making long threads unbounded on first paint.
  const { data: messagesDesc } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('match_id', id)
    .order('created_at', { ascending: false })
    .limit(500);
  const messages = (messagesDesc ?? []).reverse();

  return (
    <ChatRoom
      matchId={id}
      currentUserId={user.id}
      otherUser={visibleOtherUser}
      match={match}
      initialMessages={messages || []}
      readOnly={readOnly}
      profileUnlocked={profileUnlocked}
      unlockAvailable={unlockAvailable}
      unlockItems={unlockSummary.items}
      unlockJustOpened={deepDive === 'opened'}
    />
  );
}
