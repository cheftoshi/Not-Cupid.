import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/push';
import { rateLimit } from '@/lib/rate-limit';
import { recordFriendAction } from '@/lib/friend-events';
import { friendLocationContext } from '@/lib/friend-location';
import { ensureFriendChatRead } from '@/lib/friend-chat-read';

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
  if (!c || c.hidden_at || (c.is_test === true) !== ((user as any).is_test === true)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // A club is discoverable in its metro, but approved members and pending
  // applicants retain access after a trip ends so their membership does not
  // disappear. Knowing an ID alone does not bypass metro segmentation.
  const location = await friendLocationContext(user);
  const { data: viewerMembership } = c.creator_id === user.id
    ? { data: null }
    : await supabaseAdmin.from('friend_club_members').select('status').eq('club_id', id).eq('user_id', user.id).maybeSingle();
  const retainedAccess = c.creator_id === user.id || ['member', 'pending'].includes(viewerMembership?.status || '');
  if (!retainedAccess && location.metro && c.metro !== location.metro) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: mems } = await supabaseAdmin.from('friend_club_members').select('user_id, status').eq('club_id', id);
  const ids = (mems ?? []).map((m: any) => m.user_id);
  const { data: users } = ids.length ? await supabaseAdmin.from('users').select('id, name, photo_url, zip, is_test').in('id', ids) : { data: [] as any[] };
  const visibleUsers = (users ?? []).filter((member: any) =>
    (member.is_test === true) === ((user as any).is_test === true)
  );
  const byId = new Map(visibleUsers.map((u: any) => [u.id, u]));
  const isOwner = c.creator_id === user.id;
  const myMembership = (mems ?? []).find((m: any) => m.user_id === user.id);
  if (!isOwner && myMembership?.status !== 'member') {
    return NextResponse.json({ error: 'Members only' }, { status: 403 });
  }
  const visibleMems = (mems ?? []).filter((member: any) => byId.has(member.user_id));
  const decorate = (m: any) => { const u: any = byId.get(m.user_id) || {}; return { id: m.user_id, name: u.name, photo_url: u.photo_url }; };

  return NextResponse.json({
    club: { id: c.id, name: c.name },
    isOwner,
    members: visibleMems.filter((m: any) => m.status === 'member').map(decorate),
    // only the owner sees pending requests.
    requests: isOwner ? visibleMems.filter((m: any) => m.status === 'pending').map(decorate) : [],
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
  if (!c || c.hidden_at || (c.is_test === true) !== ((user as any).is_test === true)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { action, userId } = await req.json().catch(() => ({}));
  const meFirst = ((user.name as string) || 'someone').split(' ')[0];

  if (action === 'join') {
    const location = await friendLocationContext(user);
    if (location.metro && c.metro !== location.metro) return NextResponse.json({ error: 'That club is outside your current Friend Line metro.' }, { status: 403 });
    if (c.creator_id === user.id) return NextResponse.json({ ok: true, status: 'owner' });
    const { data: existing } = await supabaseAdmin.from('friend_club_members')
      .select('status').eq('club_id', id).eq('user_id', user.id).maybeSingle();
    if (existing) return NextResponse.json({ ok: true, status: existing.status });
    const status = c.join_mode === 'open' ? 'member' : 'pending';
    await supabaseAdmin.from('friend_club_members').upsert({ club_id: id, user_id: user.id, status }, { onConflict: 'club_id,user_id', ignoreDuplicates: true });
    if (status === 'member') await ensureFriendChatRead(user.id, 'club', id);
    await supabaseAdmin.from('friend_clubs').update({ last_active_at: new Date().toISOString() }).eq('id', id);
    await recordFriendAction({ userId: user.id, event: 'club_joined', subjectType: 'club', subjectId: id, metadata: { status } });
    if (status === 'pending') {
      await sendPushToUser(c.creator_id, { title: `${meFirst} wants to join ${c.name} 🙋`, body: 'approve them in Communities → clubs.', url: '/friends?view=pulse', tag: `club-req-${id}` }).catch(() => {});
    }
    return NextResponse.json({ ok: true, status });
  }

  if (action === 'leave') {
    await supabaseAdmin.from('friend_club_members').delete().eq('club_id', id).eq('user_id', user.id);
    await supabaseAdmin.from('friend_chat_reads').delete().eq('user_id', user.id).eq('thread_kind', 'club').eq('thread_id', id);
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
      const { data: candidate } = await supabaseAdmin.from('users').select('id, zip, is_test').eq('id', userId).maybeSingle();
      if (!candidate || (candidate.is_test === true) !== ((user as any).is_test === true)) {
        return NextResponse.json({ error: 'That request is no longer available.' }, { status: 404 });
      }
      await supabaseAdmin.from('friend_club_members').update({ status: 'member' }).eq('club_id', id).eq('user_id', userId).eq('status', 'pending');
      await ensureFriendChatRead(userId, 'club', id);
      await supabaseAdmin.from('friend_clubs').update({ last_active_at: new Date().toISOString() }).eq('id', id);
      await sendPushToUser(userId, { title: `you're in ${c.name} 🎉`, body: 'open the club chat in Communities.', url: `/friends?view=pulse&club=${encodeURIComponent(id)}`, tag: `club-ok-${id}` }).catch(() => {});
    } else {
      await supabaseAdmin.from('friend_club_members').delete().eq('club_id', id).eq('user_id', userId).eq('status', 'pending');
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
