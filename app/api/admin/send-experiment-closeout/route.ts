import { NextRequest, NextResponse } from 'next/server';
import { getAdminEmails, getCurrentAdmin } from '@/lib/admin';
import { button, escapeHtml, infoCard, renderEmail, sendEmail } from '@/lib/email';
import { looksLikePublicPostalAddress } from '@/lib/email-address';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EVENT_KEY = 'boston-dating-experiment-v1';
const TERMS_VERSION = 'boston-v13-2026-08-15';
const WINNER_APPROVAL = 'winner-closeout-v1-2026-08-19:2';
const NON_SELECTED_APPROVAL = 'round-complete-v1-2026-08-19:47';
const FULFILLMENT = 'NotCupid prepaid The Berkeley directly for the included dinner. Selected participants are not required to pay or request reimbursement for the included dinner. Food, alcoholic or non-alcoholic drinks, ordinary tax, and gratuity may all count toward the same $200 per-pair cap. Selected participants are responsible for any amount above $200, plus transportation, parking, or valet charges.';

type CloseoutMode = 'winner' | 'non-selected';
type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  email_notifications: boolean | null;
  notifications_paused_at: string | null;
  is_test: boolean | null;
  is_blocked: boolean | null;
  deleted_at: string | null;
};

function firstName(value: string | null | undefined) {
  return String(value || 'there').trim().split(/\s+/)[0] || 'there';
}

function isActiveEmailUser(user: UserRow | undefined, adminEmails: Set<string>): user is UserRow & { email: string } {
  return !!user?.email
    && user.email_notifications !== false
    && !user.notifications_paused_at
    && user.is_test !== true
    && user.is_blocked !== true
    && !user.deleted_at
    && !adminEmails.has(user.email.trim().toLowerCase());
}

async function claim(campaignKey: string, userId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('email_campaign_deliveries').insert({
    campaign_key: campaignKey,
    user_id: userId,
    variant: 'live',
    status: 'queued',
    updated_at: now,
  });
  if (!error) return true;
  if (error.code !== '23505') throw error;
  const { data, error: retryError } = await supabaseAdmin.from('email_campaign_deliveries')
    .update({ status: 'queued', updated_at: now })
    .eq('campaign_key', campaignKey)
    .eq('user_id', userId)
    .eq('status', 'failed')
    .select('id')
    .maybeSingle();
  if (retryError) throw retryError;
  return !!data;
}

async function finish(campaignKey: string, userId: string, result: Awaited<ReturnType<typeof sendEmail>>) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('email_campaign_deliveries').update(result.ok ? {
    status: 'sent',
    resend_email_id: result.id || null,
    sent_at: now,
    last_event_at: now,
    updated_at: now,
  } : {
    status: 'failed',
    last_event_at: now,
    updated_at: now,
  }).eq('campaign_key', campaignKey).eq('user_id', userId).eq('status', 'queued');
  if (error) throw error;
}

async function cohorts() {
  const [{ data: event, error: eventError }, { data: entries, error: entryError }, { data: draws, error: drawError }] = await Promise.all([
    supabaseAdmin.from('dating_experiment_events').select('status').eq('event_key', EVENT_KEY).single(),
    supabaseAdmin.from('raffle_entries').select('user_id,status,notify,terms_version').eq('event_key', EVENT_KEY),
    supabaseAdmin.from('raffle_draws')
      .select('id,user_a_id,user_b_id,status,winner_slot,restaurant,happens_at')
      .eq('event_key', EVENT_KEY)
      .eq('status', 'both_accepted'),
  ]);
  if (eventError) throw eventError;
  if (entryError) throw entryError;
  if (drawError) throw drawError;
  if (event?.status !== 'resolved') throw new Error('The Dating Experiment is not resolved.');
  const ids = [...new Set((entries || []).map((entry) => entry.user_id))];
  const { data: users, error: userError } = await supabaseAdmin.from('users')
    .select('id,name,email,email_notifications,notifications_paused_at,is_test,is_blocked,deleted_at')
    .in('id', ids);
  if (userError) throw userError;
  const userById = new Map((users || []).map((user) => [user.id, user as UserRow]));
  const winnerIds = new Set((draws || []).flatMap((draw) => [draw.user_a_id, draw.user_b_id]));
  const adminEmails = new Set(getAdminEmails());
  const participants = (entries || [])
    .filter((entry) => entry.terms_version === TERMS_VERSION && entry.status !== 'withdrawn' && entry.notify !== false)
    .map((entry) => userById.get(entry.user_id))
    .filter((user): user is UserRow & { email: string } => isActiveEmailUser(user, adminEmails));
  return {
    draws: draws || [],
    userById,
    winners: participants.filter((user) => winnerIds.has(user.id)),
    nonSelected: participants.filter((user) => !winnerIds.has(user.id)),
  };
}

function winnerEmail(user: UserRow & { email: string }, partner: UserRow | undefined, mailingAddress: string) {
  return {
    subject: 'Tomorrow night is on us ✦',
    html: renderEmail({
      preheader: 'The Berkeley at 6:30 PM. Up to $200 is prepaid by NotCupid.',
      eyebrow: 'Dating Experiment',
      headline: 'You found a mutual match.',
      mailingAddress,
      footerNote: 'NotCupid is operated by Lemon Labs.',
      bodyHtml: `<p style="margin:0 0 18px 0;">Hi ${escapeHtml(firstName(user.name))},</p>
        <p style="margin:0 0 18px 0;">Thank you for taking a chance on the NotCupid Dating Experiment. You and ${escapeHtml(firstName(partner?.name))} chose each other, and we’re genuinely happy to make tomorrow’s dinner happen.</p>
        ${infoCard({ eyebrow: 'Your dinner', big: 'Thursday, August 20 · 6:30 PM ET', sub: 'The Berkeley · 154 Berkeley Street · Boston, MA 02116' })}
        <p style="margin:18px 0;">NotCupid has prepaid up to $200 for the pair. Food, alcoholic or non-alcoholic drinks, ordinary tax, and gratuity can all count toward that total. If the final total is above $200, you’ll take care of the difference. Transportation, parking, and valet are not included.</p>
        <p style="margin:0 0 20px 0;">Please arrive a few minutes early. If anything changes, reply to this email so we can help.</p>
        ${button({ href: 'https://notcupid.com/dating-experiment?from=winner-final-details-email', label: 'VIEW DATE DETAILS →' })}`,
    }),
  };
}

function nonSelectedEmail(user: UserRow & { email: string }, mailingAddress: string) {
  return {
    subject: 'Thank you for being part of our first experiment',
    html: renderEmail({
      preheader: 'This round is complete. We’d love to see you again in September.',
      eyebrow: 'Dating Experiment',
      headline: 'Thank you for taking a chance on us.',
      recipientId: user.id,
      mailingAddress,
      footerNote: 'NotCupid is operated by Lemon Labs.',
      bodyHtml: `<p style="margin:0 0 18px 0;">Hi ${escapeHtml(firstName(user.name))},</p>
        <p style="margin:0 0 18px 0;">Thank you for joining the first NotCupid Dating Experiment. We weren’t able to confirm a mutual dinner pairing for you this time, but your participation mattered. It helped us understand how to make the next round more thoughtful and give people better options.</p>
        <p style="margin:0 0 20px 0;">We’re planning our next Boston Dating Experiment for <strong>Thursday, September 17</strong>. You’ll be among the first to hear when it opens. Joining again will always be your choice.</p>
        ${button({ href: 'https://notcupid.com/hub?from=experiment-round-complete-email', label: 'KEEP EXPLORING NOTCUPID →' })}
        <div style="margin-top:28px;padding:18px 20px;background:#f4f6ff;border-left:3px solid #2563ff;">
          <div style="font-family:'DM Mono','SF Mono',monospace;font-size:10px;color:#2563ff;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;">A note from Sunny</div>
          <p style="margin:0 0 10px 0;color:#6b6b76;">I started NotCupid because meeting people should feel more human than endless swiping. Thank you for trusting this experiment and helping us build the next one better.</p>
          <p style="margin:0;color:#0b0b0b;">Sunny<br>Founder, NotCupid</p>
        </div>`,
    }),
  };
}

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return new NextResponse(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dating Experiment closeout</title></head><body style="font-family:system-ui;padding:32px;max-width:680px;margin:auto"><h1>Dating Experiment closeout</h1><p>Each approved send is audience-count locked and idempotent.</p><form method="post" style="margin:24px 0"><input type="hidden" name="mode" value="winner"><input type="hidden" name="expected" value="2"><input type="hidden" name="approval" value="${WINNER_APPROVAL}"><button type="submit" style="padding:14px 18px">Send winner follow-up to 2</button></form><form method="post"><input type="hidden" name="mode" value="non-selected"><input type="hidden" name="expected" value="47"><input type="hidden" name="approval" value="${NON_SELECTED_APPROVAL}"><button type="submit" style="padding:14px 18px">Send round-complete email to 47</button></form></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const contentType = req.headers.get('content-type') || '';
  let body: { mode?: CloseoutMode; expected?: number; approval?: string } | null = null;
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const formMode = form.get('mode');
    body = {
      mode: formMode === 'winner' || formMode === 'non-selected' ? formMode : undefined,
      expected: Number(form.get('expected')),
      approval: String(form.get('approval') || ''),
    };
  } else {
    body = await req.json().catch(() => null) as { mode?: CloseoutMode; expected?: number; approval?: string } | null;
  }
  const mode = body?.mode;
  const expected = body?.expected;
  const requiredApproval = mode === 'winner' ? WINNER_APPROVAL : mode === 'non-selected' ? NON_SELECTED_APPROVAL : null;
  if (!requiredApproval || body?.approval !== requiredApproval || expected !== Number(requiredApproval.split(':').at(-1))) {
    return NextResponse.json({ error: 'The exact closeout send approval is missing.' }, { status: 409 });
  }
  const mailingAddress = process.env.EMAIL_MAILING_ADDRESS?.trim() || '';
  if (!looksLikePublicPostalAddress(mailingAddress)) {
    return NextResponse.json({ error: 'The production mailing address is not configured.' }, { status: 503 });
  }
  try {
    const live = await cohorts();
    const recipients = mode === 'winner' ? live.winners : live.nonSelected;
    if (recipients.length !== expected) {
      return NextResponse.json({ error: 'The approved audience count changed. Nothing was sent.', expected, actual: recipients.length }, { status: 409 });
    }
    if (mode === 'winner' && (live.draws.length !== 1 || recipients.length !== 2)) {
      return NextResponse.json({ error: 'The winner cohort is no longer exactly one pair. Nothing was sent.' }, { status: 409 });
    }
    const { error: fulfillmentError } = await supabaseAdmin.from('dating_experiment_events')
      .update({ prize_fulfillment_method: FULFILLMENT, updated_at: new Date().toISOString() })
      .eq('event_key', EVENT_KEY)
      .eq('status', 'resolved');
    if (fulfillmentError) throw fulfillmentError;

    const campaignKey = mode === 'winner'
      ? 'dating_experiment_boston_v1_winner_final_details'
      : 'dating_experiment_boston_v1_round_complete_sep17';
    let claimed = 0;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const user of recipients) {
      const content = mode === 'winner'
        ? winnerEmail(user, live.userById.get(live.draws[0].user_a_id === user.id ? live.draws[0].user_b_id : live.draws[0].user_a_id), mailingAddress)
        : nonSelectedEmail(user, mailingAddress);
      if (!await claim(campaignKey, user.id)) continue;
      claimed += 1;
      const result = await sendEmail({
        to: user.email,
        subject: content.subject,
        html: content.html,
        replyTo: 'match@notcupid.com',
        idempotencyKey: `${campaignKey}-${user.id}`,
        tags: [
          { name: 'campaign', value: campaignKey },
          { name: 'user_id', value: user.id },
          { name: 'variant', value: 'live' },
        ],
      });
      await finish(campaignKey, user.id, result);
      if (result.ok) sent += 1;
      else {
        failed += 1;
        if (errors.length < 5) errors.push(result.error || 'Provider send failed');
      }
    }
    return NextResponse.json({ ok: failed === 0, mode, eligible: recipients.length, claimed, sent, failed, errors });
  } catch (error: any) {
    console.error('[experiment-closeout-send]', { mode, message: error?.message || 'unknown' });
    return NextResponse.json({ error: 'The closeout send failed safely before completion.' }, { status: 500 });
  }
}
