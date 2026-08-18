import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import ChatRoom from './chat-room';
import { freeLoveProfileView } from '@/lib/love-deep-dive';
import { sameRealm } from '@/lib/realm';
import { withPrivateVideoPreview } from '@/lib/private-media';
import { attachStyle } from '@/lib/quiz-data';
import { markLoveNotificationOpened } from '@/lib/love-notification-ledger';
import { isPro } from '@/lib/pro';

export const dynamic = 'force-dynamic';

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ love_event?: string }>;
}) {
  const { id } = await params;
  const { love_event: loveEventId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (loveEventId) await markLoveNotificationOpened(loveEventId, user.id);

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
  const { data: otherUser } = await supabaseAdmin
    .from('users')
    .select('id, name, age, photo_url, gallery, bio, archetype, occupation, education, music, food, hobbies, sports, prompts, vibes, values_profile, attach_anxiety, attach_avoidance, attach_style, relationship_style, sun_sign, intro_video_url, is_test')
    .eq('id', otherId)
    .single();

  if (!otherUser || !sameRealm(user, otherUser)) redirect('/dashboard');
  const calibratedOtherUser = typeof otherUser.attach_anxiety === 'number' && typeof otherUser.attach_avoidance === 'number'
    ? { ...otherUser, attach_style: attachStyle(otherUser.attach_anxiety, otherUser.attach_avoidance) }
    : otherUser;
  const otherWithVideo = await withPrivateVideoPreview(calibratedOtherUser);
  // Pass only the short-lived playback URL to the client, never the stable
  // private-storage reference. The hello video and deeper profile become free
  // once both people connect; no profile field has a checkout anymore.
  const safeOtherUser = { ...otherWithVideo, intro_video_url: null };
  const visibleOtherUser = mutuallyConnected ? safeOtherUser : freeLoveProfileView(safeOtherUser);
  const { data: compatibilityRead } = await supabaseAdmin.from('love_compatibility_reads')
    .select('id')
    .eq('user_id', user.id)
    .eq('candidate_id', otherId)
    .not('connection_unlock_id', 'is', null)
    .maybeSingle();
  const compatibilityReadAvailable = !!compatibilityRead || isPro(user) || (user as any).is_test === true;

  // Keep first paint bounded. Incremental polling fetches only newer rows; old
  // conversations no longer ship hundreds of bubbles before the screen opens.
  const { data: messagesDesc } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('match_id', id)
    .order('created_at', { ascending: false })
    .limit(100);
  const messages = (messagesDesc ?? []).reverse();

  return (
    <ChatRoom
      matchId={id}
      currentUserId={user.id}
      otherUser={visibleOtherUser}
      match={match}
      initialMessages={messages || []}
      hasOlderMessages={(messagesDesc?.length ?? 0) === 100}
      readOnly={readOnly}
      profileUnlocked={mutuallyConnected}
      compatibilityReadAvailable={compatibilityReadAvailable}
    />
  );
}
