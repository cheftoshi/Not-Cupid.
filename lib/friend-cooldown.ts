import { supabaseAdmin } from '@/lib/supabase';

// Friend-pack engagement cooldown. If someone keeps getting packs and never opts
// in (no "choose the pack" + no 1:1 connect), they accrue a "skip" each opt-in
// window; after FRIEND_SKIP_CAP skips they go on a 15-day Friend-Line break so
// dead-weight accounts don't clog everyone else's packs. Love Line is untouched.
export const FRIEND_OPT_IN_WINDOW_MS = 5 * 24 * 60 * 60 * 1000; // 5 days to act on a pack
export const FRIEND_SKIP_CAP = 3;                                // 3 ignored packs →
export const FRIEND_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;      // 15-day break

export function friendCooledUntil(user: any): number {
  return user?.friend_cooldown_until ? new Date(user.friend_cooldown_until).getTime() : 0;
}
export function isFriendCooled(user: any): boolean {
  return friendCooledUntil(user) > Date.now();
}

// Lazy check, called on the roster/pack hot path. Reads the user's current pack
// engagement and advances the skip clock / sets the cooldown as a side effect.
// Graceful pre-migration: missing columns read as 0/null and the writes no-op.
export async function evaluatePackEngagement(
  user: any,
  matches: { iAccepted?: boolean; connected?: boolean }[],
): Promise<{ cooled: boolean; until: string | null }> {
  const now = Date.now();
  if (friendCooledUntil(user) > now) return { cooled: true, until: user.friend_cooldown_until };

  const optedIn = matches.some((m) => m.iAccepted || m.connected);
  const hasPack = matches.length > 0;
  const save = (patch: any) => supabaseAdmin.from('users').update(patch).eq('id', user.id).then(() => {}, () => {});

  // Re-engaged (or nothing to act on) → clear any in-progress skip clock.
  if (optedIn || !hasPack) {
    if ((user.friend_skips ?? 0) > 0 || user.friend_pack_seen_at) await save({ friend_skips: 0, friend_pack_seen_at: null });
    return { cooled: false, until: null };
  }

  // An un-opted pack is sitting there. Start the opt-in clock the first time we
  // see it; once a full window lapses with no opt-in, count a skip.
  const seenAt = user.friend_pack_seen_at ? new Date(user.friend_pack_seen_at).getTime() : 0;
  if (!seenAt) { await save({ friend_pack_seen_at: new Date(now).toISOString() }); return { cooled: false, until: null }; }
  if (now - seenAt >= FRIEND_OPT_IN_WINDOW_MS) {
    const skips = (user.friend_skips ?? 0) + 1;
    if (skips >= FRIEND_SKIP_CAP) {
      const until = new Date(now + FRIEND_COOLDOWN_MS).toISOString();
      await save({ friend_skips: 0, friend_pack_seen_at: null, friend_cooldown_until: until });
      return { cooled: true, until };
    }
    await save({ friend_skips: skips, friend_pack_seen_at: new Date(now).toISOString() });
  }
  return { cooled: false, until: null };
}
