import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import ChatRoom from './chat-room';
import { isPro } from '@/lib/pro';
import { lockedProfileView, profileUnlockSummary } from '@/lib/profile-unlock';
import { recordMonetizationEvent } from '@/lib/monetization';
import { sameRealm } from '@/lib/realm';
import { withPrivateVideoPreview } from '@/lib/private-media';

export const dynamic = 'force-dynamic';

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const otherId = match.user_1_id === user.id ? match.user_2_id : match.user_1_id;
  const [{ data: otherUser }, { data: unlock }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, name, age, photo_url, gallery, bio, archetype, occupation, education, music, food, hobbies, sports, prompts, vibes, values_profile, attach_style, relationship_style, sun_sign, intro_video_url, is_test')
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
  const profileUnlocked = isPro(user) || !!unlock?.profile_unlocked;
  const unlockSummary = profileUnlockSummary(otherUser);
  if (!profileUnlocked && unlockSummary.available && !(user as any).is_test) {
    await recordMonetizationEvent({
      userId: user.id,
      event: 'paywall_viewed',
      product: 'love_profile',
      surface: 'match_room',
      matchId: id,
      amountCents: 99,
    });
  }
  const otherWithVideo = await withPrivateVideoPreview(otherUser);
  // Pass only the short-lived playback URL to the client, never the stable
  // private-storage reference. The hello video is free inside a real match;
  // the paid profile still covers the deeper bio/gallery/compatibility story.
  const safeOtherUser = { ...otherWithVideo, intro_video_url: null };
  const visibleOtherUser = profileUnlocked ? safeOtherUser : lockedProfileView(safeOtherUser);

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
      unlockAvailable={unlockSummary.available}
      unlockItems={unlockSummary.items}
    />
  );
}
