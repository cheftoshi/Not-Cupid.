import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Inbound email webhook (Resend). Stores the message for an admin to read/reply.
//
// SECURITY: this route used to auto-reply to the `from` address, which made it
// an open email-reflection relay — an attacker could POST a forged event with
// `from` set to a victim and we'd email the victim. The auto-reply is removed;
// replies now go out only from the admin tools. If INBOUND_WEBHOOK_SECRET is
// set, we also require it (configure Resend's webhook URL with ?token=...), so
// only Resend can post here.
export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || req.headers.get('x-webhook-token');
    if (token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = await req.json().catch(() => null);
  if (!event || event.type !== 'email.received') {
    return NextResponse.json({ ok: true });
  }

  const { from, to, subject, text, html, email_id } = event.data || {};
  const fromAddr = (from || '').toLowerCase();

  // Drop system/bounce noise.
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

  return NextResponse.json({ ok: true });
}
