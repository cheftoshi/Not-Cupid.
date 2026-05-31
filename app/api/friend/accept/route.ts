import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { joinCircle } from '@/lib/friend-circles';

export const dynamic = 'force-dynamic';

// "I'm in" — the user joins their matches as a SET (no per-friend curation).
// Marks the caller accepted on every non-declined connection; any pair where
// both have now joined becomes connected and shares the group circle. Per-person
// removal is the separate /api/friend/disconnect (symmetric opt-out).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join Friend Maxxin first.' }, { status: 400 });

  const { data: conns } = await supabaseAdmin
    .from('friend_connections')
    .select('*')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .neq('status', 'declined');

  let connected = 0;
  for (const c of conns ?? []) {
    const iAmA = c.user_a_id === user.id;
    const myField = iAmA ? 'a_picked' : 'b_picked';
    const theyPicked = iAmA ? c.b_picked : c.a_picked;

    if (theyPicked) {
      // Both joined → connect + share a circle.
      const circleId = await joinCircle(c.user_a_id, c.user_b_id);
      await supabaseAdmin.from('friend_connections')
        .update({ [myField]: true, status: 'connected', circle_id: circleId, connected_at: new Date().toISOString() })
        .eq('id', c.id);
      connected++;
    } else if (!c[myField]) {
      await supabaseAdmin.from('friend_connections').update({ [myField]: true }).eq('id', c.id);
    }
  }

  return NextResponse.json({ ok: true, connected });
}
