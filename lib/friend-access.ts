import { supabaseAdmin } from '@/lib/supabase';

// Friend Maxxin access model (v3):
//   • 7-day free trial from join → explore everything EXCEPT chat
//   • FIRST crew's group chat is FREE forever (lowest barrier for new users)
//   • Pro ($2.99/mo subscription) → ALL crews' chats
//   • legacy founding (friend_paid_at) → grandfathered to all-chat access
export type FriendAccess = 'pro' | 'trial' | 'expired';

export const FRIEND_TRIAL_DAYS = 7;
export const FRIEND_PRO_CENTS = 299; // per month
export const FREE_CIRCLE_LIMIT = 1;  // first crew's chat is free
export const PRO_CIRCLE_LIMIT = 3;   // Pro = up to 3 crew chats

export function isPro(user: any): boolean {
  if (user?.friend_paid_at) return true; // grandfathered founding members
  return !!user?.friend_pro_until && new Date(user.friend_pro_until).getTime() > Date.now();
}

export function circleLimit(user: any): number {
  return isPro(user) ? PRO_CIRCLE_LIMIT : FREE_CIRCLE_LIMIT;
}

export function friendAccess(user: any): { tier: FriendAccess; daysLeft: number } {
  if (isPro(user)) return { tier: 'pro', daysLeft: 0 };
  const start = user?.friend_opted_in_at ? new Date(user.friend_opted_in_at).getTime() : Date.now();
  const elapsedDays = (Date.now() - start) / (24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, Math.ceil(FRIEND_TRIAL_DAYS - elapsedDays));
  return { tier: daysLeft > 0 ? 'trial' : 'expired', daysLeft };
}

// The circles whose chat this user can access = their N earliest-joined active
// circles, where N = 1 (free) or 3 (Pro). Deterministic by join order, so a
// user's unlocked crews stay stable as new ones form.
export async function unlockedCircleIds(user: any): Promise<string[]> {
  const limit = circleLimit(user);
  const { data } = await supabaseAdmin
    .from('friend_circle_members')
    .select('circle_id, joined_at')
    .eq('user_id', user.id)
    .is('left_at', null)
    .order('joined_at', { ascending: true })
    .limit(limit);
  return (data ?? []).map((r) => r.circle_id);
}

// Can this user use the chat for THIS circle? (within their free/Pro allowance)
export async function canUseFriendCircle(user: any, circleId: string): Promise<boolean> {
  if (!circleId) return false;
  return (await unlockedCircleIds(user)).includes(circleId);
}
