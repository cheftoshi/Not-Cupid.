import { supabaseAdmin } from '@/lib/supabase';

// Friend Maxxin access model (v2):
//   • 7-day free trial from join → everything EXCEPT chat
//   • Pro ($2.99/mo subscription, friend_pro_until in the future) → ALL chats
//   • $0.99 per-crew unlock (friend_chat_unlocks row) → THAT crew's chat
//   • legacy founding (friend_paid_at) → grandfathered to all-chat access
export type FriendAccess = 'pro' | 'trial' | 'expired';

export const FRIEND_TRIAL_DAYS = 7;
export const FRIEND_CHAT_UNLOCK_CENTS = 99;   // per-crew
export const FRIEND_PRO_CENTS = 299;          // per month

export function isPro(user: any): boolean {
  if (user?.friend_paid_at) return true; // grandfathered founding members
  return !!user?.friend_pro_until && new Date(user.friend_pro_until).getTime() > Date.now();
}

export function friendAccess(user: any): { tier: FriendAccess; daysLeft: number } {
  if (isPro(user)) return { tier: 'pro', daysLeft: 0 };
  const start = user?.friend_opted_in_at ? new Date(user.friend_opted_in_at).getTime() : Date.now();
  const elapsedDays = (Date.now() - start) / (24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, Math.ceil(FRIEND_TRIAL_DAYS - elapsedDays));
  return { tier: daysLeft > 0 ? 'trial' : 'expired', daysLeft };
}

// Can this user use the chat for THIS circle? Pro → any circle; otherwise the
// circle must be individually unlocked ($0.99).
export async function canUseFriendCircle(user: any, circleId: string): Promise<boolean> {
  if (!circleId) return false;
  if (isPro(user)) return true;
  const { data } = await supabaseAdmin
    .from('friend_chat_unlocks')
    .select('circle_id')
    .eq('user_id', user.id)
    .eq('circle_id', circleId)
    .maybeSingle();
  return !!data;
}
