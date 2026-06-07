import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import ChatRoom from './chat-room';

export const dynamic = 'force-dynamic';

export default async function MatchPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/');

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', params.id)
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
  const { data: otherUser } = await supabaseAdmin
    .from('users')
    .select('id, name, photo_url, archetype, music, food, hobbies, relationship_style')
    .eq('id', otherId)
    .single();

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('match_id', params.id)
    .order('created_at', { ascending: true });

  return (
    <ChatRoom
      matchId={params.id}
      currentUserId={user.id}
      otherUser={otherUser}
      match={match}
      initialMessages={messages || []}
      readOnly={readOnly}
    />
  );
}
