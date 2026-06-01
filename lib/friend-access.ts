import { supabaseAdmin } from '@/lib/supabase';

// Friend Maxxin access model (v4 — no subscription):
//   • 7-day free trial from join → explore everything EXCEPT chat
//   • Your FIRST crew's chat is free forever
//   • Each ADDITIONAL crew = one-time $0.99 unlock (friend_chat_unlocks row)
//   • A crew's group chat only goes LIVE when EVERY member has access — so
//     nobody can post into a room a crewmate is locked out of.
//   • legacy founding (friend_paid_at) → grandfathered: access to all crews
export type FriendAccess = 'trial' | 'active' | 'expired';

export const FRIEND_TRIAL_DAYS = 7;
export const FRIEND_CHAT_UNLOCK_CENTS = 99;

export function friendAccess(user: any): { tier: FriendAccess; daysLeft: number } {
  const start = user?.friend_opted_in_at ? new Date(user.friend_opted_in_at).getTime() : Date.now();
  const elapsedDays = (Date.now() - start) / (24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, Math.ceil(FRIEND_TRIAL_DAYS - elapsedDays));
  return { tier: daysLeft > 0 ? 'trial' : 'active', daysLeft };
}

// Group chats are FREE for everyone in a crew now — the $0.99 is for extra
// match rounds, not the chat. Kept as a function so the message routes stay
// stable (and so we could re-gate later without touching callers).
export async function hasCircleAccess(_user: any, circleId: string): Promise<boolean> {
  return !!circleId;
}

// The chat goes live the moment the crew exists (mutual-accepted members).
// No payment gate. { live, total, ready } kept so the UI shape is unchanged.
export async function circleChatStatus(circleId: string): Promise<{ live: boolean; total: number; ready: number }> {
  const { data: members } = await supabaseAdmin
    .from('friend_circle_members')
    .select('user_id')
    .eq('circle_id', circleId)
    .is('left_at', null);
  const total = (members ?? []).length;
  return { live: total > 0, total, ready: total };
}
