import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { renderEmail, sendEmail, button, C } from '@/lib/email';

// Throttle: don't fire another chat email to the same recipient about the
// same match within this window. Lets a rapid back-and-forth bundle into one
// notification instead of N separate emails.
const MESSAGE_EMAIL_THROTTLE_MIN = 5;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const matchId = req.nextUrl.searchParams.get('match_id');
  if (!matchId) return NextResponse.json({ error: 'match_id required' }, { status: 400 });

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('user_1_id, user_2_id')
    .eq('id', matchId)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  }

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  return NextResponse.json({ messages: messages || [] });
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
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  }
  if (!match.user_1_accepted || !match.user_2_accepted) {
    return NextResponse.json({ error: 'Match not active' }, { status: 400 });
  }
  if (match.chat_expires_at && new Date(match.chat_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Chat expired' }, { status: 400 });
  }

  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .insert({
      match_id,
      sender_id: user.id,
      body: body.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error('Insert message error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Await the notification so it actually runs in serverless (fire-and-forget
  // promises can get killed when the response returns). The work is gated by
  // the per-match throttle and an opt-out check, so it's usually a fast no-op;
  // when it does send, it adds ~300-500ms — acceptable for a chat send.
  // Wrap in try/catch so an email failure never blocks the message itself.
  try {
    await notifyOtherUser({
      matchId: match_id,
      senderId: user.id,
      senderName: user.name || 'your match',
      recipientId: match.user_1_id === user.id ? match.user_2_id : match.user_1_id,
      body: body.trim(),
    });
  } catch (e) {
    console.error('notifyOtherUser failed (non-blocking):', e);
  }

  return NextResponse.json({ message });
}

async function notifyOtherUser(args: {
  matchId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  body: string;
}) {
  // Pull recipient + check opt-out
  const { data: recipient } = await supabaseAdmin
    .from('users')
    .select('id, name, email, email_notifications')
    .eq('id', args.recipientId)
    .single();
  if (!recipient?.email) return;
  if (recipient.email_notifications === false) return;

  // Throttle: look up the per-match-per-recipient last-email timestamp.
  const { data: notif } = await supabaseAdmin
    .from('match_notifications')
    .select('last_message_email_at')
    .eq('match_id', args.matchId)
    .eq('recipient_id', args.recipientId)
    .maybeSingle();

  if (notif?.last_message_email_at) {
    const ageMin = (Date.now() - new Date(notif.last_message_email_at).getTime()) / 60000;
    if (ageMin < MESSAGE_EMAIL_THROTTLE_MIN) return;
  }

  // Update the throttle row first (upsert) so racing inserts can't double-send.
  await supabaseAdmin
    .from('match_notifications')
    .upsert(
      { match_id: args.matchId, recipient_id: args.recipientId, last_message_email_at: new Date().toISOString() },
      { onConflict: 'match_id,recipient_id' }
    );

  const firstName = args.senderName.split(' ')[0];
  const preview = args.body.length > 140 ? args.body.slice(0, 137) + '…' : args.body;
  const matchUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com'}/match/${args.matchId}`;

  const html = renderEmail({
    preheader: `${firstName} sent you a message: "${preview.slice(0, 80)}"`,
    eyebrow: 'new message',
    headline: `${firstName} just messaged you.`,
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper};border-left:3px solid ${C.lav};border-radius:6px;margin:6px 0 22px 0;"><tr><td style="padding:16px 18px;">
        <div style="font-family:'DM Mono','SF Mono',monospace;font-size:10px;color:${C.lav};letter-spacing:0.14em;text-transform:uppercase;margin-bottom:6px;">${firstName} said</div>
        <div style="font-family:Georgia,serif;font-size:16px;color:${C.ink};line-height:1.5;font-style:italic;">"${escapeHtml(preview)}"</div>
      </td></tr></table>

      <p style="margin:0 0 18px 0;">Jump back in and keep it going. NotCupid doesn't do push notifications — this email is your nudge.</p>

      ${button({ href: matchUrl, label: 'Open chat →' })}
    `,
    recipientId: args.recipientId,
    footerNote: `you'll get at most one of these every ${MESSAGE_EMAIL_THROTTLE_MIN} minutes per match.`,
  });

  await sendEmail({
    to: recipient.email,
    subject: `${firstName} sent you a message`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}
