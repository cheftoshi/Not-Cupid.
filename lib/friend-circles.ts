import { supabaseAdmin } from '@/lib/supabase';
import { ensureFriendChatRead } from '@/lib/friend-chat-read';

// One active crew per user. Joining/merging is atomic in Postgres, and history
// from an archived source room is never copied into a newly merged crew.

export async function activeCircleOf(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('friend_circle_members')
    .select('circle_id')
    .eq('user_id', userId)
    .is('left_at', null)
    .limit(1)
    .maybeSingle();
  return data?.circle_id ?? null;
}

// Ensure A and B share a circle. Returns the circle id.
export async function joinCircle(aId: string, bId: string): Promise<string> {
  const { data: circleId, error } = await supabaseAdmin.rpc('join_friend_circle', {
    p_user_a_id: aId,
    p_user_b_id: bId,
  });
  if (error || typeof circleId !== 'string') throw new Error(error?.message || 'Could not open the Friend crew.');
  await Promise.all([ensureFriendChatRead(aId, 'circle', circleId), ensureFriendChatRead(bId, 'circle', circleId)]);
  return circleId;
}

// Count a user's CONNECTED (mutual) friends — for the 5-max cap.
export async function connectedFriendCount(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('friend_connections')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'connected')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
  return count ?? 0;
}

// PACK SIZE — how many people a friendship pack shows you (paced DISCOVERY), and
// the per-round top-up the matcher assigns. NOT a cap on connections: connections
// are UNLIMITED (you can befriend everyone you're shown; open more packs to see
// more people). Name kept for back-comat. (Was 5, then 10; 8 on 6/24.)
export const FRIEND_MAX_CONNECTIONS = 8;
