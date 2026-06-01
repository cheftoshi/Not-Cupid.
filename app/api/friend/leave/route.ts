import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/friend/leave — opt out of your ENTIRE current crew (the friend
// group), not a single person. Declines every active connection, records
// no-repeat history so the algo routes you to fresh people, and leaves any
// shared circle/group chat. Symmetric: the other members keep each other.
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
      .eq('user_a_id', c.user_a_id).eq('user_b_id', c.user_b_id);
    await supabaseAdmin.from('friend_match_history')
      .upsert({ user_a_id: c.user_a_id, user_b_id: c.user_b_id, outcome: 'disconnected' }, { onConflict: 'user_a_id,user_b_id' });
  }

  // Leave the group chat(s) — only the user exits; the rest of the crew stays.
  for (const cid of circleIds) {
    await supabaseAdmin.from('friend_circle_members')
      .update({ left_at: new Date().toISOString() })
      .eq('circle_id', cid).eq('user_id', user.id);
  }

  return NextResponse.json({ ok: true, leftCircles: circleIds.size });
}
