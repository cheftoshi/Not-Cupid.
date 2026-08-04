import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/push';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const REPORT_HIDE_AT = 3;

async function club(id: string) {
  const { data } = await supabaseAdmin.from('friend_clubs').select('*').eq('id', id).maybeSingle();
  return data;
}

// GET — members + (for the creator) pending join requests, with names/photos.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const c = await club(id);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: mems } = await supabaseAdmin.from('friend_club_members').select('user_id, status').eq('club_id', id);
  const ids = (mems ?? []).map((m: any) => m.user_id);
  const { data: users } = ids.length ? await supabaseAdmin.from('users').select('id, name, photo_url').in('id', ids) : { data: [] as any[] };
  const byId = new Map((users ?? []).map((u: any) => [u.id, u]));
  const isOwner = c.creator_id === user.id;
  const decorate = (m: any) => { const u: any = byId.get(m.user_id) || {}; return { id: m.user_id, name: u.name, photo_url: u.photo_url }; };

  return NextResponse.json({
    isOwner,
    members: (mems ?? []).filter((m: any) => m.status === 'member').map(decorate),
    // only the owner sees pending requests.
    requests: isOwner ? (mems ?? []).filter((m: any) => m.status === 'pending').map(decorate) : [],
  });
}

// POST { action, userId? } — join (request) / leave / report / approve / decline.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `club-action:${user.id}`, windowSec: 3600, maxAttempts: 30, blockSec: 1800 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many club actions' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  const c = await club(id);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { action, userId } = await req.json().catch(() => ({}));
  const meFirst = ((user.name as string) || 'someone').split(' ')[0];

  if (action === 'join') {
    if (c.creator_id === user.id) return NextResponse.json({ ok: true, status: 'owner' });
    const { data: existing } = await supabaseAdmin.from('friend_club_members')
      .select('status').eq('club_id', id).eq('user_id', user.id).maybeSingle();
    if (existing) return NextResponse.json({ ok: true, status: existing.status });
    await supabaseAdmin.from('friend_club_members').upsert({ club_id: id, user_id: user.id, status: 'pending' }, { onConflict: 'club_id,user_id', ignoreDuplicates: true });
    await sendPushToUser(c.creator_id, { title: `${meFirst} wants to join ${c.name} 🙋`, body: 'approve them in City Pulse → clubs.', url: '/friends?view=pulse', tag: `club-req-${id}` }).catch(() => {});
    return NextResponse.json({ ok: true, status: 'pending' });
  }

  if (action === 'leave') {
    await supabaseAdmin.from('friend_club_members').delete().eq('club_id', id).eq('user_id', user.id);
    return NextResponse.json({ ok: true, status: null });
  }

  if (action === 'report') {
    await supabaseAdmin.from('friend_club_reports').upsert({ club_id: id, user_id: user.id }, { onConflict: 'club_id,user_id', ignoreDuplicates: true });
    const { count } = await supabaseAdmin.from('friend_club_reports').select('user_id', { count: 'exact', head: true }).eq('club_id', id);
    const n = count ?? 0;
    await supabaseAdmin.from('friend_clubs').update({ report_count: n, ...(n >= REPORT_HIDE_AT ? { hidden_at: new Date().toISOString() } : {}) }).eq('id', id);
    return NextResponse.json({ ok: true, reported: true, hidden: n >= REPORT_HIDE_AT });
  }

  // creator-only: approve / decline a pending request.
  if (action === 'approve' || action === 'decline') {
    if (c.creator_id !== user.id) return NextResponse.json({ error: 'Only the club owner can do that.' }, { status: 403 });
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (action === 'approve') {
      await supabaseAdmin.from('friend_club_members').update({ status: 'member' }).eq('club_id', id).eq('user_id', userId);
      await sendPushToUser(userId, { title: `you're in ${c.name} 🎉`, body: 'open the club chat in your circle.', url: '/friends?view=crew', tag: `club-ok-${id}` }).catch(() => {});
    } else {
      await supabaseAdmin.from('friend_club_members').delete().eq('club_id', id).eq('user_id', userId).eq('status', 'pending');
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
