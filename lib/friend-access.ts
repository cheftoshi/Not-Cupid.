import { supabaseAdmin } from '@/lib/supabase';

// Friend Maxxin access model (v3):
//   • 7-day free trial from join → explore everything EXCEPT chat
//   • FIRST crew's group chat is FREE forever (lowest barrier for new users)
//   • Pro ($2.99/mo subscription) → ALL crews' chats
//   • legacy founding (friend_paid_at) → grandfathered to all-chat access
export type FriendAccess = 'pro' | 'trial' | 'expired';

export const FRIEND_TRIAL_DAYS = 7;
export const FRIEND_PRO_CENTS = 299; // per month

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

// The user's "first crew" = the circle they joined earliest (still active).
// Its chat is free forever; everything beyond it needs Pro.
export async function freeCircleId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('friend_circle_members')
    .select('circle_id, joined_at')
    .eq('user_id', userId)
    .is('left_at', null)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.circle_id ?? null;
}

// Can this user use the chat for THIS circle?
//   Pro / legacy → any circle. Otherwise only their first (free) crew.
export async function canUseFriendCircle(user: any, circleId: string): Promise<boolean> {
  if (!circleId) return false;
  if (isPro(user)) return true;
  return (await freeCircleId(user.id)) === circleId;
}
