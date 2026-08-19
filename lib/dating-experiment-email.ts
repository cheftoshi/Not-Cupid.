import { button, escapeHtml, renderEmail, sendEmail } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabase';

export const DATING_EXPERIMENT_EMAIL_APPROVAL_VERSION = 'dating-experiment-selection-v1-2026-08-19';

export const DATING_EXPERIMENT_EMAIL_COPY = {
  shortlist: {
    subject: 'Your Dating Experiment shortlist is ready',
    preheader: 'Review your private options and respond by {{deadline}}.',
    body: 'We found one or two people who fit your preferences and Thursday availability. Review each profile and privately choose Yes or Pass by {{deadline}}. Your choices stay private.',
    cta: 'VIEW MY SHORTLIST →',
  },
  reminder: {
    subject: 'Your shortlist closes in one hour',
    preheader: 'Choose Yes or Pass by {{deadline}}.',
    body: 'You still have time to review your private shortlist. Choose Yes or Pass before the window closes.',
    cta: 'REVIEW MY SHORTLIST →',
  },
  winner: {
    subject: 'Your Dating Experiment dinner is confirmed',
    preheader: 'You chose each other. Here are your Thursday dinner details.',
    body: 'You and {{first_name}} both said Yes. Your reservation is {{date_time}} at {{restaurant}}. NotCupid will cover up to ${{budget}} for dinner. Please arrange your own transportation or parking.',
    cta: 'VIEW MY DATE DETAILS →',
  },
} as const;

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  email_notifications: boolean | null;
  notifications_paused_at: string | null;
  is_test: boolean | null;
  deleted_at: string | null;
  is_blocked: boolean | null;
};

type DeliveryResult = {
  approved: boolean;
  eligible: number;
  claimed: number;
  sent: number;
  failed: number;
};

type WinnerDelivery = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  winner_slot: number | null;
  restaurant: string | null;
  happens_at: string | null;
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';

function emailsApproved(): boolean {
  return process.env.DATING_EXPERIMENT_SELECTION_EMAIL_APPROVAL_VERSION === DATING_EXPERIMENT_EMAIL_APPROVAL_VERSION;
}

function firstName(name: string | null | undefined): string {
  return (name || 'your match').trim().split(/\s+/)[0] || 'your match';
}

function easternTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function deadlineTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function activeEmailUser(user: UserRow | undefined): user is UserRow & { email: string } {
  return !!user?.email
    && user.email_notifications !== false
    && !user.notifications_paused_at
    && user.is_test !== true
    && !user.deleted_at
    && user.is_blocked !== true;
}

async function claimDelivery(campaignKey: string, userId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('email_campaign_deliveries').insert({
    campaign_key: campaignKey,
    user_id: userId,
    variant: 'live',
    status: 'queued',
    updated_at: now,
  });
  if (!error) return true;
  if (error.code !== '23505') {
    console.error('[dating-experiment-email-claim]', { campaignKey, code: error.code });
    return false;
  }

  // A provider failure remains retryable, while sent/queued rows are left
  // alone. The conditional update is the atomic claim under concurrent crons.
  const { data: retry, error: retryError } = await supabaseAdmin.from('email_campaign_deliveries')
    .update({ status: 'queued', updated_at: now })
    .eq('campaign_key', campaignKey)
    .eq('user_id', userId)
    .eq('status', 'failed')
    .select('id')
    .maybeSingle();
  if (retryError) console.error('[dating-experiment-email-retry]', { campaignKey, code: retryError.code });
  return !!retry;
}

async function finishDelivery(
  campaignKey: string,
  userId: string,
  result: Awaited<ReturnType<typeof sendEmail>>,
): Promise<void> {
  const at = new Date().toISOString();
  const { error } = await supabaseAdmin.from('email_campaign_deliveries').update(result.ok ? {
    status: 'sent',
    resend_email_id: result.id || null,
    sent_at: at,
    last_event_at: at,
    updated_at: at,
  } : {
    status: 'failed',
    last_event_at: at,
    updated_at: at,
  }).eq('campaign_key', campaignKey).eq('user_id', userId).eq('status', 'queued');
  if (error) console.error('[dating-experiment-email-finish]', { campaignKey, code: error.code });
}

async function loadRecipients(ids: string[], eventKey: string): Promise<Map<string, UserRow>> {
  if (!ids.length) return new Map();
  const [{ data: users, error: usersError }, { data: entries, error: entriesError }] = await Promise.all([
    supabaseAdmin.from('users')
      .select('id, name, email, email_notifications, notifications_paused_at, is_test, deleted_at, is_blocked')
      .in('id', ids),
    supabaseAdmin.from('raffle_entries').select('user_id, notify').eq('event_key', eventKey).in('user_id', ids),
  ]);
  if (usersError) throw usersError;
  if (entriesError) throw entriesError;
  const optedIn = new Set((entries ?? []).filter((entry) => entry.notify !== false).map((entry) => entry.user_id));
  return new Map(((users ?? []) as UserRow[])
    .filter((user) => optedIn.has(user.id))
    .map((user) => [user.id, user]));
}

async function deliver(args: {
  campaignKey: string;
  eventKey: string;
  recipientIds: string[];
  content: (user: UserRow & { email: string }) => { subject: string; html: string };
}): Promise<DeliveryResult> {
  if (!emailsApproved()) return { approved: false, eligible: 0, claimed: 0, sent: 0, failed: 0 };
  const recipients = await loadRecipients([...new Set(args.recipientIds)], args.eventKey);
  const eligible = [...recipients.values()].filter(activeEmailUser);
  let claimed = 0;
  let sent = 0;
  let failed = 0;
  for (const user of eligible) {
    if (!await claimDelivery(args.campaignKey, user.id)) continue;
    claimed += 1;
    const content = args.content(user);
    const result = await sendEmail({
      to: user.email,
      subject: content.subject,
      html: content.html,
      idempotencyKey: `${args.campaignKey}-${user.id}`,
      tags: [
        { name: 'campaign', value: args.campaignKey },
        { name: 'user_id', value: user.id },
        { name: 'variant', value: 'live' },
      ],
    });
    await finishDelivery(args.campaignKey, user.id, result);
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return { approved: true, eligible: eligible.length, claimed, sent, failed };
}

export async function sendDatingExperimentShortlistEmails(args: {
  eventKey: string;
  roundNumber: number;
  responseDeadline: string;
  recipientIds: string[];
  reminder?: boolean;
}): Promise<DeliveryResult> {
  const deadline = deadlineTime(args.responseDeadline);
  const template = args.reminder ? DATING_EXPERIMENT_EMAIL_COPY.reminder : DATING_EXPERIMENT_EMAIL_COPY.shortlist;
  const campaignKey = args.reminder
    ? `dating_experiment_shortlist_reminder_r${args.roundNumber}`
    : `dating_experiment_shortlist_r${args.roundNumber}`;
  const destination = `${SITE_URL}/dating-experiment?from=${args.reminder ? 'shortlist-reminder-email' : 'shortlist-email'}`;
  return deliver({
    campaignKey,
    eventKey: args.eventKey,
    recipientIds: args.recipientIds,
    content: (user) => ({
      subject: template.subject,
      html: renderEmail({
        preheader: template.preheader.replace('{{deadline}}', deadline),
        recipientId: user.id,
        bodyHtml: `<p style="margin:0 0 20px 0;">${escapeHtml(template.body.replaceAll('{{deadline}}', deadline))}</p>${button({ href: destination, label: template.cta })}`,
      }),
    }),
  });
}

export async function sendDatingExperimentWinnerEmails(args: {
  eventKey: string;
  prizePerPairCents: number;
  draws: WinnerDelivery[];
}): Promise<DeliveryResult> {
  const recipientIds = args.draws.flatMap((draw) => [draw.user_a_id, draw.user_b_id]);
  if (!recipientIds.length) return { approved: emailsApproved(), eligible: 0, claimed: 0, sent: 0, failed: 0 };
  const users = await loadRecipients(recipientIds, args.eventKey);
  const drawsByUser = new Map<string, WinnerDelivery>();
  args.draws.forEach((draw) => {
    drawsByUser.set(draw.user_a_id, draw);
    drawsByUser.set(draw.user_b_id, draw);
  });
  const destination = `${SITE_URL}/dating-experiment?from=winner-email`;

  // Each winner slot is a separate idempotent campaign. Delivering one slot
  // must not block or duplicate the other pair.
  const totals: DeliveryResult = { approved: emailsApproved(), eligible: 0, claimed: 0, sent: 0, failed: 0 };
  for (const draw of args.draws) {
    if (!draw.happens_at || !draw.restaurant || draw.winner_slot == null) continue;
    const result = await deliver({
      campaignKey: `dating_experiment_winner_slot_${draw.winner_slot}`,
      eventKey: args.eventKey,
      recipientIds: [draw.user_a_id, draw.user_b_id],
      content: (user) => {
        const ownDraw = drawsByUser.get(user.id)!;
        const partnerId = ownDraw.user_a_id === user.id ? ownDraw.user_b_id : ownDraw.user_a_id;
        const partner = users.get(partnerId);
        const body = DATING_EXPERIMENT_EMAIL_COPY.winner.body
          .replace('{{first_name}}', firstName(partner?.name))
          .replace('{{date_time}}', easternTime(ownDraw.happens_at!))
          .replace('{{restaurant}}', ownDraw.restaurant!)
          .replace('{{budget}}', String(args.prizePerPairCents / 100));
        return {
          subject: DATING_EXPERIMENT_EMAIL_COPY.winner.subject,
          html: renderEmail({
            preheader: DATING_EXPERIMENT_EMAIL_COPY.winner.preheader,
            recipientId: user.id,
            bodyHtml: `<p style="margin:0 0 20px 0;">${escapeHtml(body)}</p>${button({ href: destination, label: DATING_EXPERIMENT_EMAIL_COPY.winner.cta })}`,
          }),
        };
      },
    });
    totals.approved = totals.approved && result.approved;
    totals.eligible += result.eligible;
    totals.claimed += result.claimed;
    totals.sent += result.sent;
    totals.failed += result.failed;
  }
  return totals;
}
