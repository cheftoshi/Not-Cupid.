import { supabaseAdmin } from '@/lib/supabase';

// The friend group chat = the connected component of the mutual-match graph.
// When two people mutually match, they end up in ONE shared circle; matching
// across circles merges them so a friend-cluster shares a single thread.

export async function activeCircleOf(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('friend_circle_members')
    .select('circle_id')
    .eq('user_id', userId)
    .is('left_at', null)
    .limit(1)
    .maybeSingle();
  return data?.circle_id ?? null;
}

// Ensure A and B share a circle. Returns the circle id.
export async function joinCircle(aId: string, bId: string): Promise<string> {
  const ca = await activeCircleOf(aId);
  const cb = await activeCircleOf(bId);

  if (ca && cb) {
    if (ca === cb) return ca;
    // Merge cb → ca: repoint members, messages, and connection circle refs.
    await supabaseAdmin.from('friend_circle_members').update({ circle_id: ca }).eq('circle_id', cb).is('left_at', null);
    await supabaseAdmin.from('friend_messages').update({ circle_id: ca }).eq('circle_id', cb);
    await supabaseAdmin.from('friend_connections').update({ circle_id: ca }).eq('circle_id', cb);
    return ca;
  }

  if (ca || cb) {
    const circle = (ca || cb) as string;
    const missing = ca ? bId : aId;
    await supabaseAdmin
      .from('friend_circle_members')
      .upsert({ circle_id: circle, user_id: missing, left_at: null }, { onConflict: 'circle_id,user_id' });
    return circle;
  }

  // Neither in a circle → create a fresh one with both.
  const { data: circle } = await supabaseAdmin.from('friend_circles').insert({}).select('id').single();
  const cid = circle!.id;
  await supabaseAdmin.from('friend_circle_members').upsert(
    [
      { circle_id: cid, user_id: aId, left_at: null },
      { circle_id: cid, user_id: bId, left_at: null },
    ],
    { onConflict: 'circle_id,user_id' }
  );
  return cid;
}

// Count a user's CONNECTED (mutual) friends — for the 5-max cap.
export async function connectedFriendCount(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('friend_connections')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'connected')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
  return count ?? 0;
}

// A friendship PACK holds 7–8 people to connect with — you pick who you want,
// they accept, and you become connections. (Was 5, then 10; set to 8 on 6/24
// when packs became per-person pick→accept.)
export const FRIEND_MAX_CONNECTIONS = 8;
