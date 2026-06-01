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

function isGrandfathered(user: any): boolean {
  return !!user?.friend_paid_at || (!!user?.friend_pro_until && new Date(user.friend_pro_until).getTime() > Date.now());
}

export function friendAccess(user: any): { tier: FriendAccess; daysLeft: number } {
  const start = user?.friend_opted_in_at ? new Date(user.friend_opted_in_at).getTime() : Date.now();
  const elapsedDays = (Date.now() - start) / (24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, Math.ceil(FRIEND_TRIAL_DAYS - elapsedDays));
  return { tier: daysLeft > 0 ? 'trial' : 'active', daysLeft };
}

// A user's free crew = the circle they joined earliest (still active).
async function freeCircleId(userId: string): Promise<string | null> {
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

// Does THIS user personally have access to THIS circle's chat?
// (free first crew, a paid unlock, or grandfathered)
export async function hasCircleAccess(user: any, circleId: string): Promise<boolean> {
  if (!circleId) return false;
  if (isGrandfathered(user)) return true;
  if ((await freeCircleId(user.id)) === circleId) return true;
  const { data } = await supabaseAdmin
    .from('friend_chat_unlocks')
    .select('circle_id')
    .eq('user_id', user.id)
    .eq('circle_id', circleId)
    .maybeSingle();
  return !!data;
}

// Is the circle chat LIVE for everyone? True only when every active member has
// access. Returns { live, total, ready } so the UI can show "waiting on N".
export async function circleChatStatus(circleId: string): Promise<{ live: boolean; total: number; ready: number }> {
  const { data: members } = await supabaseAdmin
    .from('friend_circle_members')
    .select('user_id')
    .eq('circle_id', circleId)
    .is('left_at', null);
  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return { live: false, total: 0, ready: 0 };

  // Pull the data needed to evaluate access for all members in bulk.
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, friend_paid_at, friend_pro_until')
    .in('id', ids);
  const { data: unlocks } = await supabaseAdmin
    .from('friend_chat_unlocks')
    .select('user_id')
    .eq('circle_id', circleId)
    .in('user_id', ids);
  const unlockedSet = new Set((unlocks ?? []).map((u) => u.user_id));

  // Each member's earliest circle (their free one) — one query per member.
  let ready = 0;
  for (const uid of ids) {
    const u = (users ?? []).find((x) => x.id === uid);
    if (isGrandfathered(u)) { ready++; continue; }
    if (unlockedSet.has(uid)) { ready++; continue; }
    if ((await freeCircleId(uid)) === circleId) { ready++; continue; }
  }
  return { live: ready === ids.length, total: ids.length, ready };
}
