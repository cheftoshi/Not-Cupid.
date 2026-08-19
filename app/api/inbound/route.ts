import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';
import { LOVE_RELAUNCH_CAMPAIGN } from '@/lib/love-relaunch';
import { ELIGIBLE_READY_REMINDER_CAMPAIGN } from '@/lib/eligible-ready-reminder';
import { configuredInboundForwardTo, SUPPORT_EMAIL } from '@/lib/email-address';
import { buildInboundForward, isMatchInboxRecipient, plainTextFromHtml } from '@/lib/inbound-forward';

export const dynamic = 'force-dynamic';

const MAX_FORWARD_ATTACHMENT_BYTES = 35 * 1024 * 1024;

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

const LOVE_EVENT_MAP: Record<string, { status: string; timestamp?: string }> = {
  'email.sent': { status: 'sent', timestamp: 'sent_at' },
  'email.delivered': { status: 'delivered', timestamp: 'delivered_at' },
  'email.opened': { status: 'opened', timestamp: 'opened_at' },
  'email.clicked': { status: 'clicked', timestamp: 'clicked_at' },
  'email.delivery_delayed': { status: 'sent' },
  'email.suppressed': { status: 'failed', timestamp: 'failed_at' },
  'email.failed': { status: 'failed', timestamp: 'failed_at' },
  'email.bounced': { status: 'failed', timestamp: 'failed_at' },
  'email.complained': { status: 'failed', timestamp: 'failed_at' },
};

const LOVE_STATUS_RANK: Record<string, number> = {
  claimed: 0,
  recorded: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  failed: 5,
  skipped: 5,
};

async function recordLoveNotificationEvent(event: any) {
  const mapped = LOVE_EVENT_MAP[event.type];
  const data = event?.data || {};
  const tags = data.tags && typeof data.tags === 'object' ? data.tags : {};
  const taggedId = typeof tags.love_event_id === 'string' ? tags.love_event_id : '';
  const emailId = typeof data.email_id === 'string' ? data.email_id : '';
  if (!mapped || (!taggedId && !emailId)) return false;

  const ids = new Set<string>();
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(taggedId)) ids.add(taggedId);
  if (emailId) {
    const { data: siblings } = await supabaseAdmin
      .from('love_notification_events')
      .select('id')
      .eq('provider_id', emailId);
    for (const row of siblings || []) ids.add(row.id);
  }
  if (ids.size === 0) return false;

  const { data: rows, error: readError } = await supabaseAdmin
    .from('love_notification_events')
    .select('id, recipient_id, status, sent_at, delivered_at, opened_at, clicked_at, failed_at')
    .in('id', Array.from(ids));
  if (readError) throw readError;
  const at = typeof event.created_at === 'string' ? event.created_at : new Date().toISOString();
  const affectedRecipients = new Set<string>();

  for (const row of rows || []) {
    const terminal = ['failed', 'skipped'].includes(row.status);
    const nextStatus = terminal || LOVE_STATUS_RANK[row.status] > LOVE_STATUS_RANK[mapped.status]
      ? row.status
      : mapped.status;
    const update: Record<string, any> = {
      status: nextStatus,
      provider_id: emailId || null,
      last_event_at: at,
    };
    if (mapped.timestamp && !(row as any)[mapped.timestamp]) update[mapped.timestamp] = at;
    const { error } = await supabaseAdmin
      .from('love_notification_events')
      .update(update)
      .eq('id', row.id);
    if (error) throw error;
    affectedRecipients.add(row.recipient_id);
  }

  if (['email.complained', 'email.bounced', 'email.suppressed'].includes(event.type)
    && affectedRecipients.size > 0) {
    await supabaseAdmin
      .from('users')
      .update({ email_notifications: false })
      .in('id', Array.from(affectedRecipients));
  }
  return true;
}

async function recordCampaignEvent(event: any) {
  const mapped = CAMPAIGN_EVENT_MAP[event.type];
  const data = event?.data || {};
  const tags = data.tags && typeof data.tags === 'object' ? data.tags : {};
  const campaignKey = typeof tags.campaign === 'string' ? tags.campaign : '';
  const trackedCampaigns = new Set([LOVE_RELAUNCH_CAMPAIGN, ELIGIBLE_READY_REMINDER_CAMPAIGN]);
  const tracked = trackedCampaigns.has(campaignKey) || campaignKey.startsWith('dating_experiment_');
  if (!mapped || !tracked || typeof tags.user_id !== 'string') return false;

  const userId = tags.user_id;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(userId)) return true;
  const at = typeof event.created_at === 'string' ? event.created_at : new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from('email_campaign_deliveries')
    .select('status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at')
    .eq('campaign_key', campaignKey)
    .eq('user_id', userId)
    .maybeSingle();

  const currentStatus = typeof existing?.status === 'string' ? existing.status : 'queued';
  const terminal = ['failed', 'bounced', 'suppressed', 'complained'].includes(currentStatus);
  const nextStatus = terminal || CAMPAIGN_STATUS_RANK[currentStatus] > CAMPAIGN_STATUS_RANK[mapped.status]
    ? currentStatus
    : mapped.status;
  const update: Record<string, any> = {
    campaign_key: campaignKey,
    user_id: userId,
    variant: ['ready', 'profile', 'live'].includes(tags.variant) ? tags.variant : 'ready',
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

  // A complaint or permanent delivery failure removes the address from future
  // email only. Matching participation is a separate user choice.
  if (['email.complained', 'email.bounced', 'email.suppressed'].includes(event.type)) {
    await supabaseAdmin
      .from('users')
      .update({
        email_notifications: false,
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
      const [campaignTracked, loveTracked] = await Promise.all([
        recordCampaignEvent(event),
        recordLoveNotificationEvent(event),
      ]);
      return NextResponse.json({ ok: true, tracked: campaignTracked || loveTracked, campaignTracked, loveTracked });
    } catch {
      return NextResponse.json({ error: 'Could not store email lifecycle event' }, { status: 500 });
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

  if (!isMatchInboxRecipient(email.to || [], email.received_for || [])) {
    return NextResponse.json({ ok: true, skipped: 'different-inbox' });
  }

  const text = (email.text || (email.html ? plainTextFromHtml(email.html) : '')).slice(0, 100_000);
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

  const forwardTo = configuredInboundForwardTo();
  if (!forwardTo) {
    console.error('[inbound] INBOUND_FORWARD_TO is missing or invalid');
    return NextResponse.json({ error: 'Forwarding unavailable' }, { status: 503 });
  }

  const forward = buildInboundForward({
    from,
    to: email.to || [SUPPORT_EMAIL],
    receivedFor: email.received_for || [],
    replyTo: email.reply_to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  if (!forward.fromAddress || !forward.replyTo) {
    console.error('[inbound] Verified inbound message had no safe reply address');
    return NextResponse.json({ error: 'Invalid sender' }, { status: 400 });
  }

  let attachments: Array<{ filename?: string; path: string; contentType?: string }> | undefined;
  let attachmentNote = '';
  if (email.attachments?.length) {
    const listed = await resend.emails.receiving.attachments.list({ emailId, limit: 100 });
    if (listed.error || !listed.data) {
      console.error('[inbound] Could not retrieve attachment links', { code: listed.error?.name });
      return NextResponse.json({ error: 'Could not retrieve attachments' }, { status: 502 });
    }
    const totalBytes = listed.data.data.reduce((sum, item) => sum + Math.max(0, item.size || 0), 0);
    if (totalBytes <= MAX_FORWARD_ATTACHMENT_BYTES) {
      attachments = listed.data.data.map((item) => ({
        filename: item.filename || 'attachment',
        path: item.download_url,
        contentType: item.content_type,
      }));
    } else {
      attachmentNote = `${listed.data.data.length} attachment(s) were retained in Resend but not forwarded because they exceed the 35 MB forwarding safety limit.`;
    }
  }

  const rendered = attachmentNote
    ? buildInboundForward({
        from,
        to: email.to || [SUPPORT_EMAIL],
        receivedFor: email.received_for || [],
        replyTo: email.reply_to,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachmentNote,
      })
    : forward;
  const forwarded = await resend.emails.send({
    from: 'NotCupid Inbox <match@notcupid.com>',
    to: [forwardTo],
    replyTo: rendered.replyTo!,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    attachments,
    headers: { 'X-NotCupid-Inbound-Id': emailId },
    tags: [{ name: 'source', value: 'inbound-forward' }],
  }, { idempotencyKey: `inbound-forward-${emailId}` });
  if (forwarded.error || !forwarded.data) {
    console.error('[inbound] Forward failed', { code: forwarded.error?.name });
    return NextResponse.json({ error: 'Could not forward email' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    duplicate: error?.code === '23505',
    forwarded: true,
    attachmentsForwarded: attachments?.length || 0,
  });
}
