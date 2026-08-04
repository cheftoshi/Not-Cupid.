import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/push';
import { rateLimit } from '@/lib/rate-limit';
import { metroOf } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

// Is the caller an approved member (or the creator) of this club?
async function memberOf(clubId: string, user: any): Promise<{ ok: boolean; creatorId?: string; name?: string }> {
  const { data: c } = await supabaseAdmin.from('friend_clubs').select('creator_id, name, metro, is_test, hidden_at').eq('id', clubId).maybeSingle();
  if (!c) return { ok: false };
  const metro = metroOf(user.zip);
  if (c.hidden_at || (c.is_test === true) !== (user.is_test === true) || (metro && c.metro !== metro)) return { ok: false };
  if (c.creator_id === user.id) return { ok: true, creatorId: c.creator_id, name: c.name };
  const { data: m } = await supabaseAdmin.from('friend_club_members').select('status').eq('club_id', clubId).eq('user_id', user.id).maybeSingle();
  return { ok: m?.status === 'member', creatorId: c.creator_id, name: c.name };
}

// GET ?after= — the club chat (last 200), members-only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const m = await memberOf(id, user);
  if (!m.ok) return NextResponse.json({ error: 'Members only', messages: [] }, { status: 403 });

  const after = req.nextUrl.searchParams.get('after');
  let q = supabaseAdmin.from('friend_club_messages').select('id, sender_id, body, created_at').eq('club_id', id).order('created_at', { ascending: false }).limit(200);
  if (after) q = q.gt('created_at', after);
  const { data } = await q;
  const rows = (data ?? []).slice().reverse();

  const ids = Array.from(new Set(rows.map((r) => r.sender_id)));
  const { data: users } = ids.length ? await supabaseAdmin.from('users').select('id, name, photo_url').in('id', ids) : { data: [] as any[] };
  const byId = new Map((users ?? []).map((u: any) => [u.id, u]));
  return NextResponse.json({
    name: m.name,
    messages: rows.map((r) => { const u: any = byId.get(r.sender_id) || {}; return { id: r.id, body: r.body, created_at: r.created_at, name: u.name, photo_url: u.photo_url, isMe: r.sender_id === user.id }; }),
  });
}

// POST { body } — send to the club chat (members-only); pushes the rest.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `club-message:${user.id}`, windowSec: 3600, maxAttempts: 120, blockSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many messages' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  const m = await memberOf(id, user);
  if (!m.ok) return NextResponse.json({ error: 'Members only' }, { status: 403 });

  const { body } = await req.json().catch(() => ({}));
  const text = String(body ?? '').trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: 'Empty' }, { status: 400 });

  const { data: row, error } = await supabaseAdmin.from('friend_club_messages')
    .insert({ club_id: id, sender_id: user.id, body: text }).select('id, body, created_at').single();
  if (error) return NextResponse.json({ error: 'Could not send message' }, { status: 500 });
  await supabaseAdmin.from('friend_clubs').update({ last_active_at: new Date().toISOString() }).eq('id', id);

  // notify the other approved members + owner.
  const { data: mems } = await supabaseAdmin.from('friend_club_members').select('user_id').eq('club_id', id).eq('status', 'member');
  const ids = new Set<string>([...(mems ?? []).map((x: any) => x.user_id), ...(m.creatorId ? [m.creatorId] : [])]);
  ids.delete(user.id);
  const first = ((user.name as string) || 'someone').split(' ')[0];
  await Promise.all(Array.from(ids).map((recipientId) => sendPushToUser(recipientId, { title: `${first} · ${m.name || 'club'} 💬`, body: text.length > 80 ? text.slice(0, 80) + '…' : text, url: '/friends?view=crew', tag: `club-${id}` }).catch(() => {})));

  return NextResponse.json({ ok: true, message: { id: row.id, body: row.body, created_at: row.created_at, name: user.name, photo_url: (user as any).photo_url, isMe: true } });
}
