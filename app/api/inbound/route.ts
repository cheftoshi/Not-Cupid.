import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';
import { LOVE_RELAUNCH_CAMPAIGN } from '@/lib/love-relaunch';

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

const CAMPAIGN_EVENT_MAP: Record<string, { status: string; timestamp?: string }> = {
  'email.sent': { status: 'sent', timestamp: 'sent_at' },
  'email.delivered': { status: 'delivered', timestamp: 'delivered_at' },
  'email.opened': { status: 'opened', timestamp: 'opened_at' },
  'email.clicked': { status: 'clicked', timestamp: 'clicked_at' },
  'email.delivery_delayed': { status: 'delayed' },
  'email.suppressed': { status: 'suppressed' },
  'email.failed': { status: 'failed' },
  'email.bounced': { status: 'bounced', timestamp: 'bounced_at' },
  'email.complained': { status: 'complained', timestamp: 'complained_at' },
};

const CAMPAIGN_STATUS_RANK: Record<string, number> = {
  queued: 0,
  sent: 1,
  delayed: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  failed: 5,
  bounced: 5,
  suppressed: 5,
  complained: 5,
};

async function recordCampaignEvent(event: any) {
  const mapped = CAMPAIGN_EVENT_MAP[event.type];
  const data = event?.data || {};
  const tags = data.tags && typeof data.tags === 'object' ? data.tags : {};
  if (!mapped || tags.campaign !== LOVE_RELAUNCH_CAMPAIGN || typeof tags.user_id !== 'string') return false;

  const userId = tags.user_id;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(userId)) return true;
  const at = typeof event.created_at === 'string' ? event.created_at : new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from('email_campaign_deliveries')
    .select('status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at')
    .eq('campaign_key', LOVE_RELAUNCH_CAMPAIGN)
    .eq('user_id', userId)
    .maybeSingle();

  const currentStatus = typeof existing?.status === 'string' ? existing.status : 'queued';
  const terminal = ['failed', 'bounced', 'suppressed', 'complained'].includes(currentStatus);
  const nextStatus = terminal || CAMPAIGN_STATUS_RANK[currentStatus] > CAMPAIGN_STATUS_RANK[mapped.status]
    ? currentStatus
    : mapped.status;
  const update: Record<string, any> = {
    campaign_key: LOVE_RELAUNCH_CAMPAIGN,
    user_id: userId,
    variant: ['ready', 'profile', 'love_setup', 'live'].includes(tags.variant) ? tags.variant : 'ready',
    // Provider events may arrive out of order; never turn a click back into a
    // delivery or overwrite a suppression with a late open-pixel event.
    status: nextStatus,
    resend_email_id: typeof data.email_id === 'string' ? data.email_id : null,
    last_event_at: at,
    updated_at: at,
  };
  if (mapped.timestamp && !(existing as any)?.[mapped.timestamp]) update[mapped.timestamp] = at;

  const { error } = await supabaseAdmin
    .from('email_campaign_deliveries')
    .upsert(update, { onConflict: 'campaign_key,user_id' });
  if (error) {
    console.error('[email-webhook] Could not store campaign event', { type: event.type, code: error.code });
    throw new Error('Campaign event storage failed');
  }

  // A complaint or permanent delivery failure must remove the address from
  // future campaigns. Matching currently depends on email availability, so the
  // pool flag follows the notification preference just like profile settings.
  if (['email.complained', 'email.bounced', 'email.suppressed'].includes(event.type)) {
    await supabaseAdmin
      .from('users')
      .update({
        email_notifications: false,
        pool_active: false,
        notifications_paused_at: at,
      })
      .eq('id', userId);
  }
  return true;
}

// Resend webhook for inbound replies and outbound campaign lifecycle events.
// Requests are verified against the raw body and the provider's signing secret
// before any event data is trusted or stored.
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

  if (event.type !== 'email.received') {
    try {
      const tracked = await recordCampaignEvent(event);
      return NextResponse.json({ ok: true, tracked });
    } catch {
      return NextResponse.json({ error: 'Could not store campaign event' }, { status: 500 });
    }
  }

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
