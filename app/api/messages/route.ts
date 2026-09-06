import { after, NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { acceptMatch } from '@/lib/match-actions';
import { rateLimit } from '@/lib/rate-limit';
import { enqueueLoveMessageNotification, processNotificationOutbox } from '@/lib/notification-outbox';
import { broadcastChatRefresh, chatRealtimeTopic } from '@/lib/chat-realtime';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const matchId = req.nextUrl.searchParams.get('match_id');
  if (!matchId) return NextResponse.json({ error: 'match_id required' }, { status: 400 });

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('user_1_id, user_2_id, chat_expires_at, ended_at, ended_reason, status, user_1_typing_at, user_2_typing_at, user_1_read_at, user_2_read_at')
    .eq('id', matchId)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  }

  // Incremental polling: the chat polls every few seconds — with `after` (an
  // ISO timestamp of the newest message the client has) we return only newer
  // rows instead of re-shipping the whole conversation on every poll. `before`
  // pages backward in bounded chunks when someone explicitly asks for history.
  const after = req.nextUrl.searchParams.get('after');
  const before = req.nextUrl.searchParams.get('before');
  let msgQuery = supabaseAdmin
    .from('messages')
    .select('*')
    .eq('match_id', matchId);
  if (after && !Number.isNaN(Date.parse(after))) {
    msgQuery = msgQuery.gt('created_at', after).order('created_at', { ascending: true }).limit(200);
  } else if (before && !Number.isNaN(Date.parse(before))) {
    msgQuery = msgQuery.lt('created_at', before).order('created_at', { ascending: false }).limit(100);
  } else {
    msgQuery = msgQuery.order('created_at', { ascending: false }).limit(100);
  }
  const { data: messageRows } = await msgQuery;
  const messages = after ? (messageRows ?? []) : [...(messageRows ?? [])].reverse();

  const isU1 = match.user_1_id === user.id;
  const otherTypingAt = (isU1 ? match.user_2_typing_at : match.user_1_typing_at) ?? null;
  const otherReadAt = (isU1 ? match.user_2_read_at : match.user_1_read_at) ?? null;
  // Polling with the chat open = reading. Stamp my side only on initial load or
  // when fresh messages arrive, avoiding a write on every three-second poll.
  if (!after || (messages ?? []).length > 0) {
    await supabaseAdmin.from('matches')
      .update({ [isU1 ? 'user_1_read_at' : 'user_2_read_at']: new Date().toISOString() })
      .eq('id', matchId);
  }

  // Return live match status alongside messages so the chat header can
  // auto-update (countdown ticking, or "ended" if the other person bailed).
  return NextResponse.json({
    messages: messages || [],
    incremental: !!after,
    older: !!before,
    hasMore: !!before && (messageRows?.length ?? 0) === 100,
    otherTypingAt,
    otherReadAt,
    realtimeTopic: chatRealtimeTopic('love', matchId),
    match: {
      chat_expires_at: match.chat_expires_at,
      ended_at: match.ended_at,
      ended_reason: match.ended_reason,
      status: match.status,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `match-message:${user.id}`, windowSec: 3600, maxAttempts: 120, blockSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many messages' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });

  const { match_id, body, client_id } = await req.json();
  if (!match_id || !body || typeof body !== 'string') {
    return NextResponse.json({ error: 'match_id and body required' }, { status: 400 });
  }
  if (body.trim().length === 0) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  }
  if (body.length > 2000) {
    return NextResponse.json({ error: 'Message too long (max 2000)' }, { status: 400 });
  }
  const clientId = typeof client_id === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(client_id) ? client_id : null;
  if (clientId) {
    const { data: existing } = await supabaseAdmin.from('messages')
      .select('*').eq('sender_id', user.id).eq('client_id', clientId).maybeSingle();
    if (existing) return NextResponse.json({ message: existing, already: true });
  }

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', match_id)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  const isU1 = match.user_1_id === user.id;
  const isU2 = match.user_2_id === user.id;
  if (!isU1 && !isU2) return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  if (match.ended_at || ['ended', 'passed', 'expired'].includes(match.status)) {
    return NextResponse.json({ error: 'This match has ended.' }, { status: 400 });
  }

  const bothBefore = !!(match.user_1_accepted && match.user_2_accepted);

  // Sending a message counts as accepting. If the sender hasn't accepted yet,
  // this auto-accepts them — which activates the chat the moment both sides
  // have (the picker already pre-accepted). So an opener / first reply starts
  // the conversation without a separate "accept" tap.
  let mutualNow = bothBefore;
  if (!bothBefore) {
    const acc = await acceptMatch(match_id, user.id);
    if (!acc.ok) {
      const status = acc.reason === 'at_capacity' ? 409 : acc.reason === 'not_party' ? 403 : 400;
      return NextResponse.json({ error: acc.reason === 'at_capacity'
        ? 'Close an existing Love connection before starting this one.'
        : 'This Love connection is no longer available.' }, { status });
    }
    if (acc.mutual) mutualNow = true;
  }

  // Only an already-active chat can be stale-closed; a pending opener has no
  // window yet, and a just-activated one is fresh.
  if (bothBefore && match.chat_expires_at && new Date(match.chat_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Chat expired' }, { status: 400 });
  }

  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .insert({ match_id, sender_id: user.id, body: body.trim(), client_id: clientId })
    .select()
    .single();

  if (error) {
    if (error.code === '23505' && clientId) {
      const { data: existing } = await supabaseAdmin.from('messages')
        .select('*').eq('sender_id', user.id).eq('client_id', clientId).maybeSingle();
      if (existing) return NextResponse.json({ message: existing, already: true });
    }
    console.error('Insert message error:', error);
    return NextResponse.json({ error: 'Could not send message' }, { status: 500 });
  }

  // Slide the inactivity window forward on an active chat (it never expires
  // while people are talking). A pending opener has no window until mutual.
  if (mutualNow) {
    await supabaseAdmin
      .from('matches')
      .update({ chat_expires_at: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString() })
      .eq('id', match_id);
  }

  // Persist the notification instruction before returning. Provider work is
  // leased from the durable outbox; after() is the fast path and the cron is
  // the recovery path if this serverless invocation ends early.
  if (bothBefore) {
    await enqueueLoveMessageNotification({
      matchId: match_id,
      recipientId: isU1 ? match.user_2_id : match.user_1_id,
      senderId: user.id,
      messageId: message.id,
    });
  }
  after(async () => {
    await Promise.allSettled([
      broadcastChatRefresh('love', match_id),
      processNotificationOutbox(5),
    ]);
  });

  return NextResponse.json({ message });
}
