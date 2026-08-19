import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { activeCircleOf } from '@/lib/friend-circles';
import { hasCircleAccess, circleChatStatus } from '@/lib/friend-access';
import { sendPushToUser } from '@/lib/push';
import { rateLimit } from '@/lib/rate-limit';
import { sameRealm } from '@/lib/realm';
import { ensureFriendChatRead, markFriendChatRead } from '@/lib/friend-chat-read';

export const dynamic = 'force-dynamic';

// Push every other live member of a circle immediately. The separate unread
// cron may send one fallback email after 12 hours; the per-circle push tag
// collapses a burst into one lock-screen notification.
async function pushCrew(circleId: string, ids: string[], title: string, body: string) {
  await Promise.all(
    ids.map((id) => sendPushToUser(id, { title, body, url: '/friends?view=crew&chat=pack', tag: `crew-${circleId}` }))
  );
}

// GET: the caller's friend-circle group chat — members + messages.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const circleId = await activeCircleOf(user.id);
  if (!circleId) return NextResponse.json({ circleId: null, members: [], messages: [] });

  const { data: memberRows } = await supabaseAdmin
    .from('friend_circle_members')
    .select('user_id, joined_at')
    .eq('circle_id', circleId)
    .is('left_at', null);
  const ids = (memberRows ?? []).map((m) => m.user_id);
  const visibleFrom = (memberRows ?? []).find((member) => member.user_id === user.id)?.joined_at;

  const { data: memberData } = await supabaseAdmin
    .from('users').select('id, name, photo_url, is_test').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  // A mixed-realm circle can only be legacy/corrupt data. Never expose its
  // members or message bodies while the cleanup migration retires it.
  const mixedRealm = (memberData ?? []).length !== ids.length
    || (memberData ?? []).some((member: any) => !sameRealm(user, member));
  // Mark the caller + float them first, so the "who's here" roster can say "you".
  const members = (memberData ?? [])
    .filter((member: any) => sameRealm(user, member))
    .map(({ is_test: _isTest, ...m }: any) => ({ ...m, isMe: m.id === user.id }))
    .sort((a: any, b: any) => (a.isMe === b.isMe ? 0 : a.isMe ? -1 : 1));

  // Two gates: do I personally have access, and is the chat live for everyone?
  const iHaveAccess = await hasCircleAccess(user, circleId);
  const status = await circleChatStatus(circleId);
  const canSee = iHaveAccess && status.live && !mixedRealm;

  // Withhold message bodies unless the chat is fully live (so the UI can show
  // either "unlock to join" or "waiting on N crewmates to unlock").
  // Bound the payload — fetch the most recent 200 (desc + limit), then show
  // oldest-first. A long-running crew thread no longer re-ships every message
  // on each 4s poll.
  const { data: recentMsgs } = canSee
    ? await supabaseAdmin
        .from('friend_messages')
        .select('id, sender_id, body, created_at')
        .eq('circle_id', circleId)
        .gte('created_at', visibleFrom || '1970-01-01T00:00:00.000Z')
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] };
  const messages = (recentMsgs ?? []).slice().reverse();

  let unread = 0;
  if (canSee) {
    const shouldMarkRead = req.nextUrl.searchParams.get('read') === '1';
    const { data: cursor } = await supabaseAdmin.from('friend_chat_reads').select('read_at')
      .eq('user_id', user.id).eq('thread_kind', 'circle').eq('thread_id', circleId).maybeSingle();
    if (!cursor) {
      await ensureFriendChatRead(user.id, 'circle', circleId);
    } else if (shouldMarkRead) {
      await markFriendChatRead(user.id, 'circle', circleId);
    } else {
      const { count } = await supabaseAdmin.from('friend_messages').select('id', { count: 'exact', head: true })
        .eq('circle_id', circleId).neq('sender_id', user.id)
        .gte('created_at', visibleFrom || '1970-01-01T00:00:00.000Z')
        .gt('created_at', cursor.read_at);
      unread = count ?? 0;
    }
  }

  return NextResponse.json({
    circleId, members: members ?? [], messages,
    unread,
    locked: !canSee,
    iHaveAccess,
    chatLive: status.live,
    waitingOn: Math.max(0, status.total - status.ready),
  });
}

// POST: send a message to the caller's friend circle.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `friend-message:${user.id}`, windowSec: 3600, maxAttempts: 120, blockSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many messages' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });

  const { body, client_id } = await req.json().catch(() => ({}));
  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  }
  if (body.length > 2000) return NextResponse.json({ error: 'Too long (max 2000)' }, { status: 400 });
  const clientId = typeof client_id === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(client_id) ? client_id : null;
  if (clientId) {
    const { data: existing } = await supabaseAdmin.from('friend_messages')
      .select('id, sender_id, body, created_at').eq('sender_id', user.id).eq('client_id', clientId).maybeSingle();
    if (existing) return NextResponse.json({ message: existing, already: true });
  }

  const circleId = await activeCircleOf(user.id);
  if (!circleId) return NextResponse.json({ error: 'You have no friend circle yet — match with someone first.' }, { status: 400 });

  // Re-check every live member on writes as well as reads. This prevents a
  // legacy mixed-realm circle from accepting a message or sending cross-realm
  // push notifications before the cleanup migration closes it.
  const { data: realmMemberRows } = await supabaseAdmin
    .from('friend_circle_members')
    .select('user_id')
    .eq('circle_id', circleId)
    .is('left_at', null);
  const realmMemberIds = Array.from(new Set((realmMemberRows ?? []).map((member) => member.user_id)));
  const { data: realmMembers } = await supabaseAdmin
    .from('users')
    .select('id, is_test')
    .in('id', realmMemberIds.length ? realmMemberIds : ['00000000-0000-0000-0000-000000000000']);
  const invalidRealm = !realmMemberIds.includes(user.id)
    || (realmMembers ?? []).length !== realmMemberIds.length
    || (realmMembers ?? []).some((member: any) => !sameRealm(user, member));
  if (invalidRealm) {
    return NextResponse.json({ error: 'This crew is unavailable.' }, { status: 409 });
  }

  // Must personally have access (free 1st crew or $0.99 unlock)…
  if (!(await hasCircleAccess(user, circleId))) {
    return NextResponse.json({ error: 'locked', needsUnlock: true }, { status: 402 });
  }
  // …and the chat must be live for the whole crew (no posting into a room a
  // crewmate is locked out of).
  const status = await circleChatStatus(circleId);
  if (!status.live) {
    return NextResponse.json({ error: 'waiting', waitingOn: Math.max(0, status.total - status.ready) }, { status: 409 });
  }

  const { data: message, error } = await supabaseAdmin
    .from('friend_messages')
    .insert({ circle_id: circleId, sender_id: user.id, body: body.trim(), client_id: clientId })
    .select('id, sender_id, body, created_at')
    .single();

  if (error) {
    if (error.code === '23505' && clientId) {
      const { data: existing } = await supabaseAdmin.from('friend_messages')
        .select('id, sender_id, body, created_at').eq('sender_id', user.id).eq('client_id', clientId).maybeSingle();
      if (existing) return NextResponse.json({ message: existing, already: true });
    }
    return NextResponse.json({ error: 'Could not send message' }, { status: 500 });
  }

  // Notify the rest of the crew (awaited — Vercel can kill un-awaited work, and
  // this is the crew chat's only notification channel). Never blocks the send.
  const senderFirst = (user.name || 'A crewmate').split(' ')[0];
  const preview = message.body.length > 90 ? message.body.slice(0, 90) + '…' : message.body;
  const recipientIds = realmMemberIds.filter((id) => id !== user.id);
  await pushCrew(circleId, recipientIds, `${senderFirst} · your crew`, preview).catch(() => {});

  return NextResponse.json({ message });
}
