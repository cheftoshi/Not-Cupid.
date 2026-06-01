// POST /api/admin/feedback/reply   { feedbackId, message }
//
// Admin replies to a user's app feedback. Emails the user their reply via the
// branded template, then stamps replied_at + reply_body so the admin UI shows
// it's handled. Requires the feedback row to have a user_id with an email
// (anonymous feedback can't be replied to).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { renderEmail, sendEmail, C } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const feedbackId = typeof body?.feedbackId === 'string' ? body.feedbackId : null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!feedbackId || !message) {
    return NextResponse.json({ error: 'feedbackId + message required' }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: 'Reply too long (max 4000)' }, { status: 400 });
  }

  const { data: fb } = await supabaseAdmin
    .from('feedback')
    .select('id, user_id, body')
    .eq('id', feedbackId)
    .maybeSingle();
  if (!fb) return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
  if (!fb.user_id) {
    return NextResponse.json({ error: 'That feedback was anonymous — no email to reply to.' }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, email')
    .eq('id', fb.user_id)
    .maybeSingle();
  if (!user?.email) {
    return NextResponse.json({ error: 'That user has no email on file.' }, { status: 400 });
  }

  const first = (user.name || 'there').split(' ')[0];
  const original = (fb.body || '').slice(0, 400);

  const html = renderEmail({
    preheader: `A personal reply from the NotCupid team about your feedback.`,
    eyebrow: 'a reply from notcupid',
    headline: `Hey ${first} — thanks for the note.`,
    bodyHtml: `
      <p style="margin:0 0 14px 0;">You wrote in to us, and we wanted to reply personally.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0;border-left:3px solid ${C.mutedSoft};">
        <tr><td style="padding:4px 0 4px 14px;font-family:Georgia,serif;font-style:italic;font-size:14px;color:${C.muted};line-height:1.6;">"${escapeHtml(original)}"</td></tr>
      </table>
      <p style="margin:0 0 6px 0;font-size:15px;color:${C.ink};font-weight:600;">Our reply:</p>
      <p style="margin:0 0 18px 0;white-space:pre-wrap;">${escapeHtml(message)}</p>
      <p style="margin:0;font-size:13px;color:${C.muted};">— the NotCupid team. Just reply to this email if you want to keep the conversation going.</p>
    `,
    recipientId: user.id,
    footerNote: 'we actually read every note.',
  });

  const sent = await sendEmail({
    to: user.email,
    subject: `Re: your NotCupid feedback`,
    html,
  });
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error || 'Email failed to send' }, { status: 502 });
  }

  await supabaseAdmin
    .from('feedback')
    .update({ replied_at: new Date().toISOString(), reply_body: message })
    .eq('id', feedbackId);

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
