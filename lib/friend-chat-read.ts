import { supabaseAdmin } from '@/lib/supabase';

export type FriendChatKind = 'circle' | 'club';

/** Create a clean cursor for a newly joined thread without moving an existing one. */
export async function ensureFriendChatRead(
  userId: string,
  threadKind: FriendChatKind,
  threadId: string,
): Promise<boolean> {
  const { error } = await supabaseAdmin.from('friend_chat_reads').upsert(
    { user_id: userId, thread_kind: threadKind, thread_id: threadId, read_at: new Date().toISOString() },
    { onConflict: 'user_id,thread_kind,thread_id', ignoreDuplicates: true },
  );
  if (error) {
    console.error('[friend-chat-read] could not initialize cursor', { threadKind, error: error.message });
    return false;
  }
  return true;
}

/** Opening a thread ends its unread period and permits one future reminder. */
export async function markFriendChatRead(
  userId: string,
  threadKind: FriendChatKind,
  threadId: string,
): Promise<boolean> {
  const { error } = await supabaseAdmin.from('friend_chat_reads').upsert(
    {
      user_id: userId,
      thread_kind: threadKind,
      thread_id: threadId,
      read_at: new Date().toISOString(),
      email_attempted_at: null,
      email_notified_at: null,
      last_email_message_at: null,
    },
    { onConflict: 'user_id,thread_kind,thread_id' },
  );
  if (error) {
    console.error('[friend-chat-read] could not mark thread read', { threadKind, error: error.message });
    return false;
  }
  return true;
}
