import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const MAX_REFRESHES = 3;

// POST /api/friend/reset — restart just the Friend Line scene. This shelves the
// current pack/connections into no-repeat history, clears pack cooldown state,
// and consumes one of the account's 3 lifetime rewipes.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const used = user.profile_refresh_count ?? 0;
  if (used >= MAX_REFRESHES) {
    return NextResponse.json(
      { error: `You've used all ${MAX_REFRESHES} rewipes for this account.` },
      { status: 429 }
    );
  }

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

  const { error } = await supabaseAdmin.from('users')
    .update({
      friend_skips: 0,
      friend_pack_seen_at: null,
      friend_cooldown_until: null,
      profile_refresh_count: used + 1,
    })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    resetConnections: conns?.length ?? 0,
    leftCircles: circleIds.size,
    remaining: MAX_REFRESHES - (used + 1),
  });
}
