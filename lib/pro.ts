// NotCupid All-Access — one $3.99/mo subscription that unlocks everything:
// free love-profile unlocks, free friendship packs, and events. It reuses the
// existing users.friend_pro_until column (app-wide now) + the stripe-webhook
// `friend_pro` subscription handlers, so there's no separate sub plumbing.

export const PRO_PRICE_CENTS = 399;
export const PRO_PRICE_LABEL = '$3.99/mo';

// Is this user a current All-Access subscriber? (friend_pro_until in the future)
export function isPro(user: any): boolean {
  const t = user?.friend_pro_until ? new Date(user.friend_pro_until).getTime() : 0;
  return t > Date.now();
}
