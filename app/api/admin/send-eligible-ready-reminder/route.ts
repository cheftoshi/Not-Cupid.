import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { datingExperimentEntriesOpen, getDatingExperimentEvent } from '@/lib/dating-experiment-event';
import { defaultEmailReplyTo, looksLikePublicPostalAddress } from '@/lib/email-address';
import { sendEmail } from '@/lib/email';
import { loadEligibleReadyReminderAudience } from '@/lib/eligible-ready-audience';
import {
  ELIGIBLE_READY_REMINDER_APPROVAL_VERSION,
  ELIGIBLE_READY_REMINDER_CAMPAIGN,
  ELIGIBLE_READY_REMINDER_DESTINATION,
  ELIGIBLE_READY_REMINDER_PREHEADER,
  ELIGIBLE_READY_REMINDER_SUBJECT,
  eligibleReadyReminderHtml,
} from '@/lib/eligible-ready-reminder';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function firstName(name: string | null | undefined) {
  return (name || 'there').trim().split(/\s+/)[0] || 'there';
}

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const html = eligibleReadyReminderHtml({
    userId: admin.id,
    firstName: firstName(admin.name),
    baseUrl,
    mailingAddress: process.env.EMAIL_MAILING_ADDRESS?.trim() || '109 California Ave, Quincy, MA 02169',
    tracked: false,
  });
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

// POST is a read-only dry run unless ?send=1 is explicit. Even then, delivery
// requires both the approved content version and a count-bound send approval in
// production env, so a deploy or browser click alone cannot send this email.
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const sendRequested = url.searchParams.get('send') === '1';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const mailingAddress = process.env.EMAIL_MAILING_ADDRESS?.trim() || '';
  const mailingAddressReady = looksLikePublicPostalAddress(mailingAddress);
  const contentApprovalConfigured = process.env.ELIGIBLE_READY_EMAIL_APPROVAL_VERSION === ELIGIBLE_READY_REMINDER_APPROVAL_VERSION;
  const experiment = await getDatingExperimentEvent();
  const entriesOpen = datingExperimentEntriesOpen(experiment);

  let audience;
  try {
    audience = await loadEligibleReadyReminderAudience();
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load reminder audience' }, { status: 500 });
  }
  // Keep an authorized campaign retryable after a partial provider failure:
  // completed rows stay inside the count, while a genuinely new prospect
  // changes the total and therefore invalidates the prior send authorization.
  const approvalRecipientCount = audience.candidates.length + audience.alreadyCompleted;
  const expectedSendApproval = `${ELIGIBLE_READY_REMINDER_APPROVAL_VERSION}:${approvalRecipientCount}`;
  const sendApprovalConfigured = process.env.ELIGIBLE_READY_EMAIL_SEND_APPROVAL_VERSION === expectedSendApproval;

  const audit = {
    campaign: ELIGIBLE_READY_REMINDER_CAMPAIGN,
    approvalVersion: ELIGIBLE_READY_REMINDER_APPROVAL_VERSION,
    contentApprovalConfigured,
    sendApprovalConfigured,
    expectedSendApproval,
    entriesOpen,
    mailingAddressReady,
    subject: ELIGIBLE_READY_REMINDER_SUBJECT,
    preheader: ELIGIBLE_READY_REMINDER_PREHEADER,
    sender: 'NotCupid <match@notcupid.com>',
    replyTo: defaultEmailReplyTo(),
    sendType: 'one-time production profile-ready reminder',
    audienceDefinition: 'Real, subscribed, non-admin Dating Experiment prospects age 21+ within 20 miles of 02116 whose core profile is ready, who have not entered, and who either became ready after the comeback campaign or joined after it. Test, deleted, blocked, disabled, out-of-area, opted-out, entered, push-reachable, and previously completed reminder recipients are excluded.',
    currentEligibleNonEntrants: audience.currentEligibleNonEntrants,
    excludedPushReachable: audience.excludedPushReachable,
    alreadyCompleted: audience.alreadyCompleted,
    approvalRecipientCount,
    wouldSend: audience.candidates.length,
    breakdown: {
      becameReadyAfterComeback: audience.profileConverted,
      joinedAfterComeback: audience.joinedAfterCampaign,
    },
    body: {
      greeting: 'Hi {{first_name}},',
      lead: 'Your NotCupid profile is ready.',
      invitation: 'We’re running a small Boston Dating Experiment and wanted to invite you to participate—if you choose.',
      cta: 'JOIN THE EXPERIMENT →',
      disclaimer: 'No purchase necessary. Entry, matching, and dinner selection aren’t guaranteed.',
      footer: `NotCupid · operated by Lemon Labs · ${mailingAddress || '[mailing address]'} · Unsubscribe`,
    },
    links: {
      primaryDestination: `${baseUrl}${ELIGIBLE_READY_REMINDER_DESTINATION}`,
      unsubscribe: `${baseUrl}/unsubscribe (recipient-specific signed link)`,
    },
    previewUrl: `${baseUrl}/api/admin/send-eligible-ready-reminder`,
    sample: audience.candidates.slice(0, 5).map((user) => ({
      email: user.email.replace(/^(.{2}).*(@.*)$/, '$1…$2'),
      cohort: user.created_at,
    })),
  };

  if (!sendRequested) return NextResponse.json({ ...audit, deliveryAttempted: false });
  if (!contentApprovalConfigured || !sendApprovalConfigured || !entriesOpen || !mailingAddressReady) {
    return NextResponse.json({
      ...audit,
      error: 'Reminder remains preview-only until the approved content version, exact count-bound send approval, open event, and mailing address are all confirmed.',
      deliveryAttempted: false,
    }, { status: 409 });
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const user of audience.candidates) {
    const queuedAt = new Date().toISOString();
    const { error: queueError } = await supabaseAdmin.from('email_campaign_deliveries').upsert({
      campaign_key: ELIGIBLE_READY_REMINDER_CAMPAIGN,
      user_id: user.id,
      variant: 'ready',
      status: 'queued',
      updated_at: queuedAt,
    }, { onConflict: 'campaign_key,user_id' });
    if (queueError) {
      failed++;
      errors.push('Could not reserve one reminder delivery');
      continue;
    }

    const result = await sendEmail({
      to: user.email,
      subject: ELIGIBLE_READY_REMINDER_SUBJECT,
      html: eligibleReadyReminderHtml({
        userId: user.id,
        firstName: firstName(user.name),
        baseUrl,
        mailingAddress,
      }),
      idempotencyKey: `${ELIGIBLE_READY_REMINDER_CAMPAIGN}-${user.id}`,
      tags: [
        { name: 'campaign', value: ELIGIBLE_READY_REMINDER_CAMPAIGN },
        { name: 'user_id', value: user.id },
        { name: 'variant', value: 'ready' },
      ],
    });
    const finishedAt = new Date().toISOString();
    await supabaseAdmin.from('email_campaign_deliveries').update(result.ok ? {
      status: 'sent',
      resend_email_id: result.id || null,
      sent_at: finishedAt,
      last_event_at: finishedAt,
      updated_at: finishedAt,
    } : {
      status: 'failed',
      last_event_at: finishedAt,
      updated_at: finishedAt,
    }).eq('campaign_key', ELIGIBLE_READY_REMINDER_CAMPAIGN).eq('user_id', user.id);
    if (result.ok) sent++;
    else {
      failed++;
      if (errors.length < 6) errors.push(result.error || 'Send failed');
    }
  }

  return NextResponse.json({ ok: failed === 0, campaign: ELIGIBLE_READY_REMINDER_CAMPAIGN, attempted: audience.candidates.length, sent, failed, errors });
}
