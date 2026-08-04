import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function plainTextFallback(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Resend inbound webhook. Requests are verified against the raw body and the
// provider's signing secret before any event data is trusted or stored.
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!webhookSecret || !apiKey) {
    console.error('[inbound] Resend webhook configuration is incomplete');
    return NextResponse.json({ error: 'Webhook unavailable' }, { status: 503 });
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const payload = await req.text();
  if (payload.length > 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const resend = new Resend(apiKey);
  let event: ReturnType<typeof resend.webhooks.verify>;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get('svix-id') || '',
        timestamp: req.headers.get('svix-timestamp') || '',
        signature: req.headers.get('svix-signature') || '',
      },
      webhookSecret,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (event.type !== 'email.received') return NextResponse.json({ ok: true });

  const emailId = event.data.email_id;
  if (typeof emailId !== 'string' || emailId.length > 200) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  }

  const { data: email, error: retrieveError } = await resend.emails.receiving.get(emailId, { html_format: 'cid' });
  if (retrieveError || !email) {
    console.error('[inbound] Could not retrieve verified email:', retrieveError?.message);
    return NextResponse.json({ error: 'Could not retrieve email' }, { status: 502 });
  }

  const from = String(email.from || '').trim().slice(0, 320);
  const fromLower = from.toLowerCase();
  if (
    fromLower.includes('mailer-daemon')
    || fromLower.includes('postmaster')
    || fromLower.includes('no-reply')
    || fromLower.includes('noreply')
  ) {
    return NextResponse.json({ ok: true, skipped: 'system' });
  }

  const text = (email.text || (email.html ? plainTextFallback(email.html) : '')).slice(0, 100_000);
  const { error } = await supabaseAdmin.from('inbound_messages').insert({
    from_email: from,
    to_email: (email.to || []).join(', ').slice(0, 2000),
    subject: String(email.subject || '').slice(0, 500),
    body_text: text,
    // Never store remote HTML. Admin surfaces can render body_text safely.
    body_html: null,
    resend_email_id: emailId,
  });

  if (error && error.code !== '23505') {
    console.error('[inbound] Store failed:', error);
    return NextResponse.json({ error: 'Could not store email' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, duplicate: error?.code === '23505' });
}
