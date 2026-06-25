import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Private 1:1 DMs between CONNECTED friends. Separate from the pack/crew group
// chat (which lives in friend_circles). Only a `status='connected'` pair can DM.

async function areConnected(userId: string, otherId: string): Promise<boolean> {
  const [aId, bId] = [userId, otherId].sort();
  const { data } = await supabaseAdmin
    .from('friend_connections')
    .select('status')
    .eq('user_a_id', aId).eq('user_b_id', bId)
    .maybeSingle();
  return data?.status === 'connected';
}

// GET ?with=<otherId> → the 1:1 thread (messages) + the other person's basics.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const otherId = req.nextUrl.searchParams.get('with');
  if (!otherId || otherId === user.id) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  if (!(await areConnected(user.id, otherId))) {
    return NextResponse.json({ error: 'Not connected', messages: [] }, { status: 403 });
  }

  const [aId, bId] = [user.id, otherId].sort();
  const after = req.nextUrl.searchParams.get('after');
  let q = supabaseAdmin
    .from('friend_dms')
    .select('id, sender_id, body, created_at')
    .eq('user_a_id', aId).eq('user_b_id', bId)
    .order('created_at', { ascending: true });
  if (after) q = q.gt('created_at', after);
  const { data: messages } = await q;

  const { data: other } = await supabaseAdmin
    .from('users').select('id, name, photo_url').eq('id', otherId).maybeSingle();

  return NextResponse.json({
    messages: (messages ?? []).map((m: any) => ({ ...m, isMe: m.sender_id === user.id })),
    other: other ?? null,
  });
}

// POST { otherId, body } → send a DM to a connected friend.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { otherId, body } = await req.json().catch(() => ({}));
  const text = String(body ?? '').trim().slice(0, 2000);
  if (!otherId || otherId === user.id || !text) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  if (!(await areConnected(user.id, otherId))) {
    return NextResponse.json({ error: 'Not connected' }, { status: 403 });
  }

  const [aId, bId] = [user.id, otherId].sort();
  const { data: row, error } = await supabaseAdmin
    .from('friend_dms')
    .insert({ user_a_id: aId, user_b_id: bId, sender_id: user.id, body: text })
    .select('id, sender_id, body, created_at')
    .single();
  if (error) return NextResponse.json({ error: 'Could not send' }, { status: 500 });

  const meFirst = (user.name || 'A friend').split(' ')[0];
  await sendPushToUser(otherId, {
    title: `${meFirst} messaged you 🧡`,
    body: text.length > 80 ? text.slice(0, 80) + '…' : text,
    url: '/friends?dm=' + user.id, tag: `friend-dm-${aId}-${bId}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, message: { ...row, isMe: true } });
}
