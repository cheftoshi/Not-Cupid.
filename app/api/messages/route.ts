import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { acceptMatch } from '@/lib/match-actions';
import { renderEmail, sendEmail, button } from '@/lib/email';
import { sendPushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

const MESSAGE_EMAIL_THROTTLE_MS = 60 * 60 * 1000; // one new-message email per hour per match

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const matchId = req.nextUrl.searchParams.get('match_id');
  if (!matchId) return NextResponse.json({ error: 'match_id required' }, { status: 400 });

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('user_1_id, user_2_id, chat_expires_at, ended_at, ended_reason, status')
    .eq('id', matchId)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  }

  // Incremental polling: the chat polls every few seconds — with `after` (an
  // ISO timestamp of the newest message the client has) we return only newer
  // rows instead of re-shipping the whole conversation on every poll.
  const after = req.nextUrl.searchParams.get('after');
  let msgQuery = supabaseAdmin
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  if (after && !Number.isNaN(Date.parse(after))) {
    msgQuery = msgQuery.gt('created_at', after);
  }
  const { data: messages } = await msgQuery;

  // Return live match status alongside messages so the chat header can
  // auto-update (countdown ticking, or "ended" if the other person bailed).
  return NextResponse.json({
    messages: messages || [],
    incremental: !!after,
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

  const { match_id, body } = await req.json();
  if (!match_id || !body || typeof body !== 'string') {
    return NextResponse.json({ error: 'match_id and body required' }, { status: 400 });
  }
  if (body.trim().length === 0) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  }
  if (body.length > 2000) {
    return NextResponse.json({ error: 'Message too long (max 2000)' }, { status: 400 });
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
    if (acc.ok && acc.mutual) mutualNow = true;
  }

  // Only an already-active chat can be stale-closed; a pending opener has no
  // window yet, and a just-activated one is fresh.
  if (bothBefore && match.chat_expires_at && new Date(match.chat_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Chat expired' }, { status: 400 });
  }

  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .insert({ match_id, sender_id: user.id, body: body.trim() })
    .select()
    .single();

  if (error) {
    console.error('Insert message error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Slide the inactivity window forward on an active chat (it never expires
  // while people are talking). A pending opener has no window until mutual.
  if (mutualNow) {
    await supabaseAdmin
      .from('matches')
      .update({ chat_expires_at: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString() })
      .eq('id', match_id);
  }

  // Activity email to the recipient (throttled 1/hr per match). Skipped when
  // this message just activated the match — acceptMatch already sent the
  // "it's a match" email in that case, so we don't double up.
  if (bothBefore) {
    notifyNewMessage(match_id, isU1 ? match.user_2_id : match.user_1_id, user.id).catch((e) =>
      console.error('notifyNewMessage failed', e)
    );
  }

  return NextResponse.json({ message });
}

async function notifyNewMessage(matchId: string, recipientId: string, senderId: string) {
  const { data: recipient } = await supabaseAdmin
    .from('users').select('email, email_notifications').eq('id', recipientId).single();
  if (!recipient?.email || recipient.email_notifications === false) return;

  const { data: senderRow } = await supabaseAdmin.from('users').select('name').eq('id', senderId).single();
  const senderFirst = (senderRow?.name || 'Your match').split(' ')[0];

  // Push: every message (the per-chat tag collapses stacked pings — the
  // lock screen shows one "Maya sent you a message", not ten).
  await sendPushToUser(recipientId, {
    title: `${senderFirst} sent you a message`,
    body: 'Open the chat before it goes quiet.',
    url: `/match/${matchId}`,
    tag: `chat-${matchId}`,
  });

  const { data: throttle } = await supabaseAdmin
    .from('match_notifications')
    .select('last_message_email_at')
    .eq('match_id', matchId).eq('recipient_id', recipientId)
    .maybeSingle();
  if (
    throttle?.last_message_email_at &&
    Date.now() - new Date(throttle.last_message_email_at).getTime() < MESSAGE_EMAIL_THROTTLE_MS
  ) return;

  const senderName = senderFirst;
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';

  await sendEmail({
    to: recipient.email,
    subject: `${senderName} sent you a message`,
    html: renderEmail({
      preheader: `${senderName} just messaged you on NotCupid.`,
      eyebrow: 'new message',
      headline: `${senderName} sent you a message.`,
      bodyHtml: `<p style="margin:0 0 18px 0;">Don't leave them hanging — the chat goes quiet after 36h of silence.</p>${button({ href: `${base}/match/${matchId}`, label: 'Open the chat →' })}`,
    }),
  });

  await supabaseAdmin.from('match_notifications').upsert(
    { match_id: matchId, recipient_id: recipientId, last_message_email_at: new Date().toISOString() },
    { onConflict: 'match_id,recipient_id' }
  );
}
