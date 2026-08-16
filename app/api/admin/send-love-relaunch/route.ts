import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { button, C, escapeHtml, renderEmail, sendEmail } from '@/lib/email';
import {
  LOVE_RELAUNCH_APPROVAL_VERSION,
  LOVE_RELAUNCH_CAMPAIGN,
  LOVE_RELAUNCH_SUBJECT,
  loveRelaunchPath,
  loveRelaunchUrl,
} from '@/lib/love-relaunch';
import { withReturningUserWelcome } from '@/lib/returning-user';
import { defaultEmailReplyTo, looksLikePublicPostalAddress } from '@/lib/email-address';
import { RAFFLE, raffleEligible, raffleLaunchBlockers } from '@/lib/raffle';
import { datingExperimentEntriesOpen, getDatingExperimentEvent } from '@/lib/dating-experiment-event';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_RUN_MS = 52_000;
const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 1_100;
const CAMPAIGN_ACTIVE_DAYS = 90;

type CampaignUser = {
  id: string;
  name: string | null;
  email: string;
  age: number | null;
  zip: string | null;
  photo_url: string | null;
  bio: string | null;
  hobbies: string[] | null;
  music: string[] | null;
  food: string[] | null;
  sports: string[] | null;
  created_at: string;
};

type Variant = 'ready' | 'profile' | 'live';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function variantFor(user: CampaignUser, hasLiveMatch: boolean): Variant {
  if (missingProfileItems(user).length > 0) return 'profile';
  if (hasLiveMatch) return 'live';
  return 'ready';
}

function missingProfileItems(user: CampaignUser): string[] {
  const interests = (user.hobbies?.length ?? 0) + (user.music?.length ?? 0) + (user.food?.length ?? 0) + (user.sports?.length ?? 0);
  const missing: string[] = [];
  if (!user.photo_url) missing.push('a profile photo');
  if (!user.bio?.trim()) missing.push('a short bio');
  if (interests < 3) missing.push('at least 3 interests');
  return missing;
}

function campaignHtml(
  user: CampaignUser,
  variant: Variant,
  baseUrl: string,
  options: { tracked?: boolean; mailingAddress?: string } = {},
): string {
  const first = (user.name || 'there').split(' ')[0];
  const firstHtml = escapeHtml(first);
  const missing = missingProfileItems(user);
  const directDestination = '/dating-experiment?from=dating-experiment-comeback-preview';
  const experimentUrl = options.tracked === false
    ? `${baseUrl}${directDestination}`
    : loveRelaunchUrl(baseUrl, user.id, 'experiment');
  const profileUrl = options.tracked === false
    ? `${baseUrl}${withReturningUserWelcome('/profile?from=dating-experiment-comeback-preview')}`
    : loveRelaunchUrl(baseUrl, user.id, 'profile');
  const loveLineUrl = options.tracked === false
    ? `${baseUrl}${withReturningUserWelcome('/dashboard?from=dating-experiment-comeback-preview')}`
    : loveRelaunchUrl(baseUrl, user.id, 'dashboard');
  const faqUrl = `${baseUrl}/dating-experiment/faq`;
  const termsUrl = `${baseUrl}/dating-experiment/terms`;
  const primaryUrl = variant === 'profile' ? profileUrl : experimentUrl;
  const cta = variant === 'profile' ? 'get my profile ready →' : 'join the Dating Experiment →';
  const lead = variant === 'live'
    ? 'Your current conversations are still there. This is a separate, smaller way to meet someone new without giving up the connections you already have.'
    : variant === 'profile'
      ? 'Your quiz is already in. Your Dating Experiment entry needs a few profile basics first, and we’ve listed exactly what is missing below.'
      : 'Your NotCupid profile is ready for the first Boston Dating Experiment.';

  return renderEmail({
    preheader: `${first}, August 20 in Boston: two mutual pairs and dinner up to $${RAFFLE.budget} per pair on us.`,
    eyebrow: 'The NotCupid Dating Experiment · August 20 · Boston',
    headline: `${first}, want us to put dinner on the calendar?`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${firstHtml}, ${lead.charAt(0).toLowerCase()}${lead.slice(1)}</p>
      <p style="margin:0 0 18px 0;">We&apos;re trying a more human way to date: not an infinite swipe deck, and not a blind assignment. You set the preferences. We build a small compatibility-led shortlist. You decide who you would actually meet—and they decide privately too.</p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;">
        <tr><td style="padding:11px 0;border-top:1px solid ${C.border};"><strong style="color:${C.ink};">Tell us what you actually want</strong><br><span style="font-size:13px;">Choose your age range, orientation, and one or more genders you&apos;re open to meeting. Preferences must work both ways.</span></td></tr>
        <tr><td style="padding:11px 0;border-top:1px solid ${C.border};"><strong style="color:${C.ink};">Meet up to two—privately</strong><br><span style="font-size:13px;">See a compatibility-led profile, photos, and answers. A private 5–15 second hello video is optional and never changes eligibility or selection.</span></td></tr>
        <tr><td style="padding:11px 0;border-top:1px solid ${C.border};"><strong style="color:${C.ink};">You choose. They choose.</strong><br><span style="font-size:13px;">Say yes or pass in private. Only people who choose each other enter the dinner selection.</span></td></tr>
        <tr><td style="padding:11px 0;border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};"><strong style="color:${C.ink};">Dinner is on us · Thursday, August 20</strong><br><span style="font-size:13px;">One pair at 6:30 PM and one at 8:30 PM. Up to $${RAFFLE.budget} per pair; the Boston restaurant is shared privately later.</span></td></tr>
      </table>

      <div style="margin:0 0 18px 0;">${button({ href: primaryUrl, label: cta })}</div>
      ${variant === 'profile' ? `<p style="margin:0 0 12px 0;padding:12px 14px;background:${C.lavSoft};border-radius:10px;font-size:13px;"><strong style="color:${C.ink};">Your next step:</strong> add ${escapeHtml(missing.join(', '))}. Once those basics are ready, the experiment screen will walk you through four short prompts and an optional private video.</p>` : ''}
      <p style="margin:0 0 10px 0;font-size:13px;">Want the full plan first? <a href="${faqUrl}" style="color:${C.lav};font-weight:600;">Read how the experiment works.</a></p>
      <p style="margin:0 0 18px 0;font-size:13px;">The regular Love Line is still here too. <a href="${loveLineUrl}" style="color:${C.lav};font-weight:600;">See your current rotation and conversations.</a></p>
      <p style="margin:0;font-size:11px;line-height:1.55;color:${C.muted};">No purchase necessary. Entry closes ${RAFFLE.entryCloseLabel} or at ${RAFFLE.cap} eligible entries. Massachusetts residents age 21+ within ${RAFFLE.radiusMiles} miles of ${RAFFLE.centerZip}. Entry is free, payment and Pro status never affect selection, and no match or prize is guaranteed. Up to ${RAFFLE.winnerPairCount} dinners; maximum value $${RAFFLE.budget} per selected pair and $${RAFFLE.budget * RAFFLE.winnerPairCount} total. Odds depend on the eligible pool, reciprocal preferences, compatibility, and private mutual choices. Void where prohibited. <a href="${termsUrl}" style="color:${C.lav};">Official Rules.</a></p>
    `,
    recipientId: options.tracked === false ? undefined : user.id,
    footerNote: 'two private options. mutual choice. two real dinner tables.',
    mailingAddress: options.mailingAddress,
  });
}

async function loadAudience() {
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, age, zip, photo_url, bio, hobbies, music, food, sports, created_at')
    .is('deleted_at', null)
    .not('email', 'is', null)
    .not('archetype', 'is', null)
    .eq('pool_active', true)
    .eq('is_blocked', false)
    .is('matching_disabled_at', null)
    .neq('email_notifications', false)
    .neq('is_test', true);
  if (error) throw new Error('Could not load the active Love audience');
  return (users || []).filter((user: any) =>
    typeof user.email === 'string'
    && user.email.includes('@')
    && Number.isInteger(user.age)
    && user.age >= 21
    && raffleEligible(user)
  ) as CampaignUser[];
}

function previewUser(admin: any): CampaignUser {
  return {
    id: admin.id,
    name: admin.name || 'there',
    email: admin.email || 'preview@notcupid.com',
    age: Number.isInteger(admin.age) ? admin.age : 30,
    zip: admin.zip || RAFFLE.centerZip,
    photo_url: admin.photo_url || null,
    bio: admin.bio || 'Ready for a real conversation.',
    hobbies: admin.hobbies || ['trying new places'],
    music: admin.music || ['live music'],
    food: admin.food || ['dinner'],
    sports: admin.sports || null,
    created_at: admin.created_at || new Date().toISOString(),
  };
}

// Browser-safe preview only. This renders the exact ready-profile variant but
// never reserves a delivery, records a campaign event, or contacts Resend.
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const requestedVariant = new URL(req.url).searchParams.get('variant');
  const variant: Variant = requestedVariant === 'profile' || requestedVariant === 'live' ? requestedVariant : 'ready';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const html = campaignHtml(previewUser(admin), variant, baseUrl, {
    tracked: false,
    mailingAddress: process.env.EMAIL_MAILING_ADDRESS?.trim(),
  });
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry') === '1';
  const testOnly = url.searchParams.get('test') === '1';
  const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : null;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const mailingAddress = process.env.EMAIL_MAILING_ADDRESS?.trim();
  const mailingAddressReady = looksLikePublicPostalAddress(mailingAddress);
  const approvalConfigured = process.env.DATING_EXPERIMENT_EMAIL_APPROVAL_VERSION === LOVE_RELAUNCH_APPROVAL_VERSION;
  const sendApprovalConfigured = process.env.DATING_EXPERIMENT_EMAIL_SEND_APPROVAL_VERSION === LOVE_RELAUNCH_APPROVAL_VERSION;
  const experiment = await getDatingExperimentEvent();
  const entriesOpen = datingExperimentEntriesOpen(experiment);

  // A test or production delivery is impossible until the exact draft version
  // and the final recipient count receive separate out-of-band approvals, AND
  // the experiment itself passes every launch gate. Dry runs remain available
  // because they provably contact no recipient.
  if (!dryRun && (!approvalConfigured || !sendApprovalConfigured || !entriesOpen)) {
    return NextResponse.json({
      error: 'Dating Experiment email is preview-only until copy and send are separately approved and entries are open.',
      approvalVersion: LOVE_RELAUNCH_APPROVAL_VERSION,
      approvalConfigured,
      sendApprovalConfigured,
      entriesOpen,
      mailingAddressConfigured: !!mailingAddress,
      mailingAddressReady,
      launchBlockers: raffleLaunchBlockers(),
    }, { status: 409 });
  }

  if (testOnly) {
    if (!admin.email) return NextResponse.json({ error: 'Admin account has no email' }, { status: 400 });
    const testUser: CampaignUser = { ...previewUser(admin), email: admin.email };
    const result = await sendEmail({
      to: admin.email,
      subject: `[TEST] ${LOVE_RELAUNCH_SUBJECT}`,
      // Test messages use direct app links so clicking a preview cannot pollute
      // production campaign metrics.
      html: campaignHtml(testUser, 'ready', baseUrl, { tracked: false, mailingAddress }),
      tags: [{ name: 'campaign', value: `${LOVE_RELAUNCH_CAMPAIGN}_test` }],
    });
    return NextResponse.json(result.ok ? { ok: true, sentTo: admin.email } : { error: result.error }, { status: result.ok ? 200 : 502 });
  }

  let users: CampaignUser[];
  try {
    users = await loadAudience();
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load audience' }, { status: 500 });
  }

  const activeCutoff = new Date(Date.now() - CAMPAIGN_ACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: liveMatches }, deliveryResult, { data: activeSessions }] = await Promise.all([
    supabaseAdmin
      .from('matches')
      .select('user_1_id, user_2_id')
      .eq('user_1_accepted', true)
      .eq('user_2_accepted', true)
      .is('ended_at', null),
    supabaseAdmin
      .from('email_campaign_deliveries')
      .select('user_id, status, updated_at')
      .eq('campaign_key', LOVE_RELAUNCH_CAMPAIGN),
    supabaseAdmin
      .from('sessions')
      .select('user_id')
      .gte('last_used_at', activeCutoff),
  ]);

  if (deliveryResult.error) {
    return NextResponse.json({
      error: 'Campaign tracking is not ready. Apply migration 20260807_email_campaign_deliveries.sql first.',
    }, { status: 503 });
  }

  const liveSet = new Set<string>();
  for (const match of liveMatches || []) {
    liveSet.add(match.user_1_id);
    liveSet.add(match.user_2_id);
  }
  const recentlyActiveSet = new Set((activeSessions || []).map((session: any) => session.user_id));
  const activeUsers = users.filter((user) =>
    recentlyActiveSet.has(user.id) || user.created_at >= activeCutoff || liveSet.has(user.id)
  );
  const recentQueuedCutoff = Date.now() - 10 * 60 * 1000;
  const completed = new Set((deliveryResult.data || [])
    .filter((row: any) => row.status !== 'failed' && (
      row.status !== 'queued' || new Date(row.updated_at).getTime() > recentQueuedCutoff
    ))
    .map((row: any) => row.user_id));
  let candidates = activeUsers.filter((user) => !completed.has(user.id));
  if (limit) candidates = candidates.slice(0, limit);

  const breakdown = candidates.reduce<Record<Variant, number>>((counts, user) => {
    counts[variantFor(user, liveSet.has(user.id))] += 1;
    return counts;
  }, { ready: 0, profile: 0, live: 0 });

  if (dryRun) {
    return NextResponse.json({
      campaign: LOVE_RELAUNCH_CAMPAIGN,
      approvalVersion: LOVE_RELAUNCH_APPROVAL_VERSION,
      approvalConfigured,
      sendApprovalConfigured,
      entriesOpen,
      mailingAddressConfigured: !!mailingAddress,
      mailingAddressReady,
      launchBlockers: raffleLaunchBlockers(),
      subject: LOVE_RELAUNCH_SUBJECT,
      sender: 'NotCupid <match@notcupid.com>',
      replyTo: defaultEmailReplyTo(),
      sendType: 'production marketing campaign (preview only; no delivery authorized)',
      audienceDefinition: `Real, non-blocked, subscribed Love users age 21+ within ${RAFFLE.radiusMiles} miles of ${RAFFLE.centerZip}, with a completed core quiz and account activity in the last ${CAMPAIGN_ACTIVE_DAYS} days or a current mutual match. Test, deleted, disabled, dormant, invalid-email, previously completed, and out-of-area accounts are excluded.`,
      eligibleActiveBostonUsers: activeUsers.length,
      excludedDormant: users.length - activeUsers.length,
      activeWindowDays: CAMPAIGN_ACTIVE_DAYS,
      alreadySent: completed.size,
      wouldSend: candidates.length,
      breakdown,
      links: {
        primaryReady: `${baseUrl}${loveRelaunchPath('experiment')}`,
        primaryNeedsProfile: `${baseUrl}${loveRelaunchPath('profile')}`,
        profileFix: `${baseUrl}${loveRelaunchPath('profile')}`,
        loveLine: `${baseUrl}${loveRelaunchPath('dashboard')}`,
        faq: `${baseUrl}/dating-experiment/faq`,
        officialRules: `${baseUrl}/dating-experiment/terms`,
        unsubscribe: `${baseUrl}/unsubscribe`,
      },
      previewUrls: {
        ready: `${baseUrl}/api/admin/send-love-relaunch?variant=ready`,
        needsProfile: `${baseUrl}/api/admin/send-love-relaunch?variant=profile`,
        liveMatch: `${baseUrl}/api/admin/send-love-relaunch?variant=live`,
      },
      sample: candidates.slice(0, 5).map((user) => ({
        email: user.email.replace(/^(.{2}).*(@.*)$/, '$1…$2'),
        variant: variantFor(user, liveSet.has(user.id)),
      })),
      limit,
    });
  }

  if (!mailingAddressReady) {
    return NextResponse.json({
      error: 'Set EMAIL_MAILING_ADDRESS to a complete physical postal address or registered PO Box, including ZIP code, before sending this marketing campaign.',
    }, { status: 503 });
  }

  const startedAt = Date.now();
  let sent = 0;
  let failed = 0;
  let processed = 0;
  const errors: string[] = [];

  for (let index = 0; index < candidates.length; index += BATCH_SIZE) {
    if (Date.now() - startedAt > MAX_RUN_MS) break;
    const batch = candidates.slice(index, index + BATCH_SIZE);
    const results = await Promise.all(batch.map(async (user) => {
      const variant = variantFor(user, liveSet.has(user.id));
      const queuedAt = new Date().toISOString();
      const { error: queueError } = await supabaseAdmin
        .from('email_campaign_deliveries')
        .upsert({
          campaign_key: LOVE_RELAUNCH_CAMPAIGN,
          user_id: user.id,
          variant,
          status: 'queued',
          updated_at: queuedAt,
        }, { onConflict: 'campaign_key,user_id' });
      if (queueError) return { ok: false, error: 'Could not reserve campaign delivery' };

      const result = await sendEmail({
        to: user.email,
        subject: LOVE_RELAUNCH_SUBJECT,
        html: campaignHtml(user, variant, baseUrl, { mailingAddress }),
        idempotencyKey: `${LOVE_RELAUNCH_CAMPAIGN}-${user.id}`,
        tags: [
          { name: 'campaign', value: LOVE_RELAUNCH_CAMPAIGN },
          { name: 'user_id', value: user.id },
          { name: 'variant', value: variant },
        ],
      });

      const finishedAt = new Date().toISOString();
      await supabaseAdmin
        .from('email_campaign_deliveries')
        .update(result.ok ? {
          status: 'sent',
          resend_email_id: result.id || null,
          sent_at: finishedAt,
          last_event_at: finishedAt,
          updated_at: finishedAt,
        } : {
          status: 'failed',
          last_event_at: finishedAt,
          updated_at: finishedAt,
        })
        .eq('campaign_key', LOVE_RELAUNCH_CAMPAIGN)
        .eq('user_id', user.id);
      return result;
    }));

    results.forEach((result) => {
      processed += 1;
      if (result.ok) sent += 1;
      else {
        failed += 1;
        if (errors.length < 8) errors.push(result.error || 'send failed');
      }
    });
    if (index + BATCH_SIZE < candidates.length) await wait(BATCH_DELAY_MS);
  }

  const remaining = candidates.length - processed;
  return NextResponse.json({
    ok: true,
    campaign: LOVE_RELAUNCH_CAMPAIGN,
    totalCandidates: candidates.length,
    processed,
    sent,
    failed,
    remaining,
    errors,
    note: remaining > 0 ? `Re-run to continue with ${remaining} unsent recipients.` : undefined,
  });
}
