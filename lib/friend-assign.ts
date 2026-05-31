import { supabaseAdmin } from '@/lib/supabase';
import { rankFriendCandidates } from '@/lib/friend-matching';
import { FRIEND_MAX_CONNECTIONS } from '@/lib/friend-circles';

// Auto-assign: top the user up to FRIEND_MAX_CONNECTIONS (5) friend matches by
// score, excluding anyone they already have a connection or history with, and
// respecting the OTHER person's 5-cap too. Idempotent + lazy — safe to call on
// every matches-fetch, so we don't need a cron for v1. Returns # created.
export async function assignFriendMatches(userId: string, max = FRIEND_MAX_CONNECTIONS): Promise<number> {
  const { data: me } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
  if (!me || !me.friend_opted_in_at) return 0;

  const { data: conns } = await supabaseAdmin
    .from('friend_connections')
    .select('user_a_id, user_b_id, status')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
  const active = (conns ?? []).filter((c) => c.status !== 'declined');
  if (active.length >= max) return 0;
  const need = max - active.length;

  const { data: hist } = await supabaseAdmin
    .from('friend_match_history')
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
  const seen = new Set<string>();
  [...(conns ?? []), ...(hist ?? [])].forEach((r: any) =>
    seen.add(r.user_a_id === userId ? r.user_b_id : r.user_a_id)
  );

  const { data: pool } = await supabaseAdmin
    .from('users')
    .select('*')
    .not('friend_opted_in_at', 'is', null)
    .is('deleted_at', null)
    .neq('id', userId);

  const fresh = (pool ?? []).filter((p) => !seen.has(p.id));
  const ranked = rankFriendCandidates(me, fresh);

  let created = 0;
  for (const { user: cand, score } of ranked) {
    if (created >= need) break;
    // Respect the candidate's own active-cap so we don't overload popular users.
    const { data: candConns } = await supabaseAdmin
      .from('friend_connections')
      .select('status')
      .or(`user_a_id.eq.${cand.id},user_b_id.eq.${cand.id}`);
    const candActive = (candConns ?? []).filter((c) => c.status !== 'declined').length;
    if (candActive >= max) continue;

    const [a, b] = [userId, cand.id].sort();
    const { error } = await supabaseAdmin.from('friend_connections').upsert(
      { user_a_id: a, user_b_id: b, status: 'pending', compatibility_score: score },
      { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: true }
    );
    if (!error) created++;
  }
  return created;
}
