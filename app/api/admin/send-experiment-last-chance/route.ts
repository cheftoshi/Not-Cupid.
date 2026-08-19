import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { datingExperimentEntriesOpen, getDatingExperimentEvent } from '@/lib/dating-experiment-event';
import { looksLikePublicPostalAddress } from '@/lib/email-address';
import { sendEmail } from '@/lib/email';
import { loadEligibleReadyReminderAudience } from '@/lib/eligible-ready-audience';
import {
  ELIGIBLE_READY_REMINDER_CAMPAIGN,
  EXPERIMENT_LAST_CHANCE_APPROVAL_VERSION,
  EXPERIMENT_LAST_CHANCE_EXPECTED_RECIPIENTS,
  EXPERIMENT_LAST_CHANCE_PREHEADER,
  EXPERIMENT_LAST_CHANCE_SUBJECT,
  experimentLastChanceHtml,
} from '@/lib/eligible-ready-reminder';
import { dailyActivityEasternDay } from '@/lib/daily-activity-cadence';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function firstName(name: string | null | undefined) {
  return (name || 'there').trim().split(/\s+/)[0] || 'there';
}

async function loadAudience() {
  const audience = await loadEligibleReadyReminderAudience();
  const { data: dailyRows, error } = await supabaseAdmin
    .from('activity_digest_deliveries')
    .select('user_id')
    .eq('delivery_day', dailyActivityEasternDay(new Date()))
    .eq('status', 'sent');
  if (error) throw error;
  const emailedToday = new Set((dailyRows ?? []).map((row) => row.user_id));
  return {
    candidates: audience.candidates.filter((user) => !emailedToday.has(user.id)),
    excludedDailyEmailToday: audience.candidates.filter((user) => emailedToday.has(user.id)).length,
  };
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sendRequested = body.send === true;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const mailingAddress = process.env.EMAIL_MAILING_ADDRESS?.trim() || '';
  const mailingAddressReady = looksLikePublicPostalAddress(mailingAddress);
  const experiment = await getDatingExperimentEvent();
  const entriesOpen = datingExperimentEntriesOpen(experiment);

  let audience;
  try {
    audience = await loadAudience();
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load last-chance audience' }, { status: 500 });
  }

  const audit = {
    approvalVersion: EXPERIMENT_LAST_CHANCE_APPROVAL_VERSION,
    expectedRecipients: EXPERIMENT_LAST_CHANCE_EXPECTED_RECIPIENTS,
    wouldSend: audience.candidates.length,
    excludedDailyEmailToday: audience.excludedDailyEmailToday,
    entriesOpen,
    mailingAddressReady,
    subject: EXPERIMENT_LAST_CHANCE_SUBJECT,
    preheader: EXPERIMENT_LAST_CHANCE_PREHEADER,
    body: {
      lead: 'Your NotCupid profile is ready.',
      invitation: 'Entries for the Boston Dating Experiment close tonight at 11:59 PM ET. If you want to participate, finish your entry before the deadline.',
      cta: 'JOIN BEFORE 11:59 PM →',
      disclaimer: 'No purchase necessary. Entry, matching, and dinner selection aren’t guaranteed.',
    },
    deliveryAttempted: false,
  };
  if (!sendRequested) return NextResponse.json(audit);

  const approvalMatches = body.approvalVersion === EXPERIMENT_LAST_CHANCE_APPROVAL_VERSION
    && body.recipientCount === EXPERIMENT_LAST_CHANCE_EXPECTED_RECIPIENTS;
  if (!approvalMatches || audience.candidates.length !== EXPERIMENT_LAST_CHANCE_EXPECTED_RECIPIENTS || !entriesOpen || !mailingAddressReady) {
    return NextResponse.json({
      ...audit,
      error: 'Last-chance send refused: approval, exact recipient count, open entry window, and mailing address must all match.',
    }, { status: 409 });
  }

  let sent = 0;
  let failed = 0;
  let skippedEntered = 0;
  const errors: string[] = [];
  for (const user of audience.candidates) {
    const { count, error: entryError } = await supabaseAdmin.from('raffle_entries')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_key', 'boston-dating-experiment-v1')
      .eq('user_id', user.id)
      .neq('status', 'withdrawn');
    if (entryError) { failed++; errors.push('Could not recheck one recipient'); continue; }
    if ((count ?? 0) > 0) { skippedEntered++; continue; }

    const queuedAt = new Date().toISOString();
    const { error: queueError } = await supabaseAdmin.from('email_campaign_deliveries').upsert({
      campaign_key: ELIGIBLE_READY_REMINDER_CAMPAIGN,
      user_id: user.id,
      variant: 'last_chance_v1',
      status: 'queued',
      updated_at: queuedAt,
    }, { onConflict: 'campaign_key,user_id' });
    if (queueError) { failed++; errors.push('Could not reserve one delivery'); continue; }

    const result = await sendEmail({
      to: user.email,
      subject: EXPERIMENT_LAST_CHANCE_SUBJECT,
      html: experimentLastChanceHtml({
        userId: user.id,
        firstName: firstName(user.name),
        baseUrl,
        mailingAddress,
      }),
      idempotencyKey: `dating-experiment-last-chance-v1-2026-08-18-${user.id}`,
      tags: [
        { name: 'campaign', value: ELIGIBLE_READY_REMINDER_CAMPAIGN },
        { name: 'user_id', value: user.id },
        { name: 'variant', value: 'last_chance_v1' },
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
    else { failed++; if (errors.length < 3) errors.push(result.error || 'Provider send failed'); }
  }

  return NextResponse.json({
    ok: failed === 0 && sent + skippedEntered === EXPERIMENT_LAST_CHANCE_EXPECTED_RECIPIENTS,
    attempted: audience.candidates.length,
    sent,
    failed,
    skippedEntered,
    errors,
  });
}
