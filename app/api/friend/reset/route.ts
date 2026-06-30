import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/friend/reset — restart just the Friend Line scene. This shelves the
// current pack/connections into no-repeat history and clears pack cooldown state
// so the roster endpoint can route the user toward fresh people.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: conns } = await supabaseAdmin
    .from('friend_connections')
    .select('*')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .neq('status', 'declined');

  const circleIds = new Set<string>();
  for (const c of conns ?? []) {
    if (c.circle_id) circleIds.add(c.circle_id);
    await supabaseAdmin.from('friend_connections')
      .update({ status: 'declined', circle_id: null })
      .eq('user_a_id', c.user_a_id)
      .eq('user_b_id', c.user_b_id);
    await supabaseAdmin.from('friend_match_history')
      .upsert(
        { user_a_id: c.user_a_id, user_b_id: c.user_b_id, outcome: 'friend_reset' },
        { onConflict: 'user_a_id,user_b_id' }
      );
  }

  for (const circleId of circleIds) {
    await supabaseAdmin.from('friend_circle_members')
      .update({ left_at: new Date().toISOString() })
      .eq('circle_id', circleId)
      .eq('user_id', user.id);
  }

  await supabaseAdmin.from('users')
    .update({ friend_skips: 0, friend_pack_seen_at: null, friend_cooldown_until: null })
    .eq('id', user.id);

  return NextResponse.json({ ok: true, resetConnections: conns?.length ?? 0, leftCircles: circleIds.size });
}
