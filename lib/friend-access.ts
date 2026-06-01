// Friend Maxxin access tiers:
//   full   — founding member (paid) → everything, incl. the group chat
//   trial  — within 7 days of joining, not paid → everything EXCEPT the chat
//   expired— past 7 days, not paid → locked, must go founding
export type FriendAccess = 'full' | 'trial' | 'expired';

export const FRIEND_TRIAL_DAYS = 7;
export const FRIEND_FOUNDING_PRICE_CENTS = 299;

export function friendAccess(user: any): { tier: FriendAccess; daysLeft: number } {
  if (user?.friend_paid_at) return { tier: 'full', daysLeft: 0 };
  const start = user?.friend_opted_in_at ? new Date(user.friend_opted_in_at).getTime() : Date.now();
  const elapsedDays = (Date.now() - start) / (24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, Math.ceil(FRIEND_TRIAL_DAYS - elapsedDays));
  return { tier: daysLeft > 0 ? 'trial' : 'expired', daysLeft };
}

export function canUseFriendChat(user: any): boolean {
  return friendAccess(user).tier === 'full';
}
