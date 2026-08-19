import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/push';
import { rateLimit } from '@/lib/rate-limit';
import { sameRealm } from '@/lib/realm';

export const dynamic = 'force-dynamic';

// Private 1:1 DMs between CONNECTED friends. Separate from the pack/crew group
// chat (which lives in friend_circles). Only a `status='connected'` pair can DM.

async function areConnected(userId: string, otherId: string): Promise<boolean> {
  const [aId, bId] = [userId, otherId].sort();
  const { data } = await supabaseAdmin
    .from('friend_connections')
    .select('status')
    .eq('user_a_id', aId).eq('user_b_id', bId)
    .limit(1);
  return data?.[0]?.status === 'connected';
}

// GET ?with=<otherId> → the 1:1 thread (messages) + the other person's basics.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const otherId = req.nextUrl.searchParams.get('with');

  // No `with` → unread summary across ALL my DM threads (badge counts for the
  // connections rail). Graceful if friend_dm_reads isn't migrated yet.
  if (!otherId) {
    const unread: Record<string, number> = {};
    try {
      const { data: rows } = await supabaseAdmin
        .from('friend_dms').select('user_a_id, user_b_id, sender_id, created_at')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .order('created_at', { ascending: false }).limit(400);
      const { data: reads } = await supabaseAdmin
        .from('friend_dm_reads').select('other_id, read_at').eq('user_id', user.id);
      const readByOther = new Map((reads ?? []).map((r: any) => [r.other_id, r.read_at]));
      (rows ?? []).forEach((m: any) => {
        if (m.sender_id === user.id) return;
        const other = m.user_a_id === user.id ? m.user_b_id : m.user_a_id;
        const readAt = readByOther.get(other);
        if (!readAt || new Date(m.created_at) > new Date(readAt)) unread[other] = (unread[other] || 0) + 1;
      });
    } catch { /* reads table not migrated — no badges */ }
    return NextResponse.json({ unread });
  }

  if (otherId === user.id) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  const { data: other } = await supabaseAdmin
    .from('users').select('id, name, photo_url, is_test').eq('id', otherId).is('deleted_at', null).maybeSingle();
  if (!other || !sameRealm(user, other)) {
    return NextResponse.json({ error: 'Not connected', messages: [] }, { status: 403 });
  }
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

  // Opening/polling the thread = reading it. Graceful pre-migration.
  try {
    await supabaseAdmin.from('friend_dm_reads').upsert(
      { user_id: user.id, other_id: otherId, read_at: new Date().toISOString() },
      { onConflict: 'user_id,other_id' }
    );
  } catch { /* reads table not migrated */ }

  return NextResponse.json({
    messages: (messages ?? []).map((m: any) => ({ ...m, isMe: m.sender_id === user.id })),
    other: other ?? null,
  });
}

// POST { otherId, body } → send a DM to a connected friend.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `friend-dm:${user.id}`, windowSec: 3600, maxAttempts: 120, blockSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many messages' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });

  const { otherId, body, clientId } = await req.json().catch(() => ({}));
  const text = String(body ?? '').trim().slice(0, 2000);
  const safeClientId = typeof clientId === 'string' && clientId.length >= 8 && clientId.length <= 100 ? clientId : null;
  if (!otherId || otherId === user.id || !text) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  const { data: other } = await supabaseAdmin
    .from('users').select('id, is_test').eq('id', otherId).is('deleted_at', null).maybeSingle();
  if (!other || !sameRealm(user, other)) {
    return NextResponse.json({ error: 'Not connected' }, { status: 403 });
  }
  if (!(await areConnected(user.id, otherId))) {
    return NextResponse.json({ error: 'Not connected' }, { status: 403 });
  }

  const [aId, bId] = [user.id, otherId].sort();
  const { data: row, error } = await supabaseAdmin
    .from('friend_dms')
    .insert({ user_a_id: aId, user_b_id: bId, sender_id: user.id, body: text, client_id: safeClientId })
    .select('id, sender_id, body, created_at')
    .single();
  if (error) {
    if (error.code === '23505' && safeClientId) {
      const { data: existing } = await supabaseAdmin.from('friend_dms')
        .select('id, sender_id, body, created_at')
        .eq('sender_id', user.id).eq('client_id', safeClientId).maybeSingle();
      if (existing) return NextResponse.json({ ok: true, duplicate: true, message: { ...existing, isMe: true } });
    }
    console.error('friend dm insert failed', error);
    return NextResponse.json({ error: 'Could not send' }, { status: 500 });
  }

  const meFirst = (user.name || 'A friend').split(' ')[0];
  await sendPushToUser(otherId, {
    title: `${meFirst} messaged you 🧡`,
    body: text.length > 80 ? text.slice(0, 80) + '…' : text,
    url: '/friends?dm=' + user.id, tag: `friend-dm-${aId}-${bId}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, message: { ...row, isMe: true } });
}
