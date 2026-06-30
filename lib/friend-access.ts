import { supabaseAdmin } from '@/lib/supabase';

// Friend Line access model (v6 — weekly packs, 6/30):
//   • Your FIRST friendship pack (up to 10 friends) is FREE
//   • Each ADDITIONAL weekly pack = one-time $0.99 (a fresh batch of up to 10 friends)
//   • Group chats are FREE for everyone in a pack — the $0.99 buys the pack
//   • All-Access ($3.99/mo) → packs are free (see lib/pro.ts)
export type FriendAccess = 'trial' | 'active' | 'expired';

export const FRIEND_TRIAL_DAYS = 7;
// One weekly friendship pack = $0.99.
export const FRIEND_PACK_CENTS = 99;
// Back-compat alias — older imports referenced FRIEND_CHAT_UNLOCK_CENTS.
export const FRIEND_CHAT_UNLOCK_CENTS = FRIEND_PACK_CENTS;

export function friendAccess(user: any): { tier: FriendAccess; daysLeft: number } {
  const start = user?.friend_opted_in_at ? new Date(user.friend_opted_in_at).getTime() : Date.now();
  const elapsedDays = (Date.now() - start) / (24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, Math.ceil(FRIEND_TRIAL_DAYS - elapsedDays));
  return { tier: daysLeft > 0 ? 'trial' : 'active', daysLeft };
}

// Group chats are FREE for everyone in a crew now — the $0.99 is for fresh
// weekly packs, not the chat. Kept as a function so the message routes stay
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
