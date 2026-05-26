import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const event = await req.json();
  if (event.type !== 'email.received') {
    return NextResponse.json({ ok: true });
  }

  const { from, to, subject, text, html, email_id } = event.data;
  const fromAddr = (from || '').toLowerCase();

  if (
    fromAddr.includes('mailer-daemon') ||
    fromAddr.includes('postmaster') ||
    fromAddr.includes('no-reply') ||
    fromAddr.includes('noreply')
  ) {
    return NextResponse.json({ ok: true, skipped: 'system' });
  }

  await supabaseAdmin.from('inbound_messages').insert({
    from_email: from,
    to_email: to,
    subject,
    body_text: text,
    body_html: html,
    resend_email_id: email_id,
  });

  await resend.emails.send({
    from: 'NotCupid <match@notcupid.com>',
    to: from,
    subject: `Re: ${subject || 'your message'}`,
    html: `
      <p>Hey 👋</p>
      <p>Got your message — sunny reads everything that comes in here and will get back to you soon.</p>
      <p>Quick heads up: to accept or pass on a match, tap the buttons in the match email itself. Both of you have to tap <strong>Accept</strong> before we share contact info.</p>
      <p>— NotCupid</p>
    `,
  });

  return NextResponse.json({ ok: true });
}
