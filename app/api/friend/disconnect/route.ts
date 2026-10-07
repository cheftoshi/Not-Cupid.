import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Opt out of a friend match. Declines the pairwise connection, records no-repeat
// history, and removes the user from the shared circle if this was their only
// tie to it (so they leave the group chat cleanly when they have no friends left
// in that circle).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { otherId } = await req.json().catch(() => ({}));
  if (!otherId) return NextResponse.json({ error: 'otherId required' }, { status: 400 });

  const [aId, bId] = [user.id, otherId].sort();
  const { data: conn, error: lookupError } = await supabaseAdmin
    .from('friend_connections').select('*').eq('user_a_id', aId).eq('user_b_id', bId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: 'Connection temporarily unavailable' }, { status: 503 });
  if (!conn) return NextResponse.json({ error: 'No such connection' }, { status: 404 });

  const circleId = conn.circle_id;
  const { error: declineError } = await supabaseAdmin.from('friend_connections')
    .update({ status: 'declined', circle_id: null })
    .eq('user_a_id', aId).eq('user_b_id', bId);
  if (declineError) return NextResponse.json({ error: 'Could not close this connection. Please retry.' }, { status: 503 });
  const { error: historyError } = await supabaseAdmin.from('friend_match_history')
    .upsert({ user_a_id: aId, user_b_id: bId, outcome: 'disconnected' }, { onConflict: 'user_a_id,user_b_id' });
  // The retained declined connection also excludes this pair from assignment.
  if (historyError) console.error('[friend-disconnect] history write failed', { code: historyError.code });

  // For each of the two, if they have no remaining CONNECTED tie in this circle,
  // remove them from it (leave the group chat).
  if (circleId) {
    for (const uid of [user.id, otherId]) {
      const { count, error: countError } = await supabaseAdmin
        .from('friend_connections')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'connected')
        .eq('circle_id', circleId)
        .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`);
      if (!countError && count === 0) {
        await supabaseAdmin.from('friend_circle_members')
          .update({ left_at: new Date().toISOString() })
          .eq('circle_id', circleId).eq('user_id', uid);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
