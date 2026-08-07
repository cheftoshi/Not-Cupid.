import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { button, C, escapeHtml, renderEmail, sendEmail } from '@/lib/email';
import {
  LOVE_RELAUNCH_CAMPAIGN,
  loveRelaunchUrl,
  type LoveRelaunchDestination,
} from '@/lib/love-relaunch';
import { withReturningUserWelcome } from '@/lib/returning-user';

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
  photo_url: string | null;
  intro_video_url: string | null;
  attach_style: string | null;
  created_at: string;
};

type Variant = 'ready' | 'profile' | 'love_setup' | 'live';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function variantFor(user: CampaignUser, hasLiveMatch: boolean): Variant {
  if (hasLiveMatch) return 'live';
  if (!user.photo_url) return 'profile';
  if (!user.attach_style) return 'love_setup';
  return 'ready';
}

function destinationFor(variant: Variant): LoveRelaunchDestination {
  if (variant === 'profile') return 'profile';
  if (variant === 'love_setup') return 'love_setup';
  return 'dashboard';
}

function campaignHtml(
  user: CampaignUser,
  variant: Variant,
  baseUrl: string,
  options: { tracked?: boolean; mailingAddress?: string } = {},
): string {
  const first = (user.name || 'there').split(' ')[0];
  const firstHtml = escapeHtml(first);
  const destination = destinationFor(variant);
  const directDestination = destination === 'dashboard'
    ? withReturningUserWelcome('/dashboard?from=love-relaunch-test')
    : destination === 'profile'
      ? withReturningUserWelcome('/profile?from=love-relaunch-test')
      : '/quiz?line=love&from=love-relaunch-test';
  const primaryUrl = options.tracked === false
    ? `${baseUrl}${directDestination}`
    : loveRelaunchUrl(baseUrl, user.id, destination);
  const profileUrl = options.tracked === false
    ? `${baseUrl}${withReturningUserWelcome('/profile?from=love-relaunch-test')}`
    : loveRelaunchUrl(baseUrl, user.id, 'profile');
  const cta = variant === 'live'
    ? 'continue your connections →'
    : variant === 'profile'
      ? 'finish your Love profile →'
      : variant === 'love_setup'
        ? 'finish your Love setup →'
        : 'open your Love Line →';
  const lead = variant === 'live'
    ? 'Your conversations are still there, and the space around them is better: clearer next moves, easier date planning, and a profile that can finally sound like you.'
    : variant === 'profile'
      ? 'Your quiz is already in. Add one strong face photo and a short hello so the people you meet have something real to respond to.'
      : variant === 'love_setup'
        ? 'Your core quiz is already in. Finish the focused Love setup and we can build a better roster around what you actually want.'
        : 'Your Love profile is ready for the new flow. Come see the people in your current rotation and choose who feels worth a conversation.';

  return renderEmail({
    preheader: `${first}, Love Line now gives you a clearer roster, richer profiles, and an easier path to a real date.`,
    eyebrow: 'Love Line, rebuilt',
    headline: `${first}, come see what changed.`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${firstHtml}, ${lead.charAt(0).toLowerCase()}${lead.slice(1)}</p>
      <p style="margin:0 0 18px 0;">NotCupid is still quiz-based and still has no infinite swipe deck. The difference is that Love Line now gives you more agency without turning dating into another feed.</p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;">
        <tr><td style="padding:11px 0;border-top:1px solid ${C.border};"><strong style="color:${C.ink};">Up to five curated options</strong><br><span style="font-size:13px;">Choose who you want to open—not who the app assigns.</span></td></tr>
        <tr><td style="padding:11px 0;border-top:1px solid ${C.border};"><strong style="color:${C.ink};">Three conversations at a time</strong><br><span style="font-size:13px;">Enough room to meet people, without an endless pile of matches.</span></td></tr>
        <tr><td style="padding:11px 0;border-top:1px solid ${C.border};"><strong style="color:${C.ink};">Photos + a 15–30 second hello</strong><br><span style="font-size:13px;">Show some personality before anyone has to invent an opener.</span></td></tr>
        <tr><td style="padding:11px 0;border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};"><strong style="color:${C.ink};">A simpler route to meeting</strong><br><span style="font-size:13px;">Conversation help and date ideas live next to the chat.</span></td></tr>
      </table>

      <div style="margin:0 0 18px 0;">${button({ href: primaryUrl, label: cta })}</div>
      ${variant !== 'profile' ? `<p style="margin:0;font-size:13px;">Want to make a stronger first impression first? <a href="${profileUrl}" style="color:${C.lav};font-weight:600;">Add photos or a short video hello.</a></p>` : ''}
    `,
    recipientId: user.id,
    footerNote: 'smaller roster. better reasons to say hello.',
    mailingAddress: options.mailingAddress,
  });
}

async function loadAudience() {
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, photo_url, intro_video_url, attach_style, created_at')
    .is('deleted_at', null)
    .not('email', 'is', null)
    .not('archetype', 'is', null)
    .eq('pool_active', true)
    .eq('is_blocked', false)
    .is('matching_disabled_at', null)
    .neq('email_notifications', false)
    .neq('is_test', true);
  if (error) throw new Error('Could not load the active Love audience');
  return (users || []).filter((user: any) => typeof user.email === 'string' && user.email.includes('@')) as CampaignUser[];
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

  if (testOnly) {
    if (!admin.email) return NextResponse.json({ error: 'Admin account has no email' }, { status: 400 });
    const testUser: CampaignUser = {
      id: admin.id,
      name: admin.name || 'there',
      email: admin.email,
      photo_url: admin.photo_url || null,
      intro_video_url: admin.intro_video_url || null,
      attach_style: admin.attach_style || null,
      created_at: admin.created_at || new Date().toISOString(),
    };
    const result = await sendEmail({
      to: admin.email,
      subject: '[TEST] Love Line just got a serious upgrade',
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
  }, { ready: 0, profile: 0, love_setup: 0, live: 0 });

  if (dryRun) {
    return NextResponse.json({
      campaign: LOVE_RELAUNCH_CAMPAIGN,
      eligibleActiveLoveUsers: activeUsers.length,
      excludedDormant: users.length - activeUsers.length,
      activeWindowDays: CAMPAIGN_ACTIVE_DAYS,
      alreadySent: completed.size,
      wouldSend: candidates.length,
      breakdown,
      sample: candidates.slice(0, 5).map((user) => ({
        email: user.email.replace(/^(.{2}).*(@.*)$/, '$1…$2'),
        variant: variantFor(user, liveSet.has(user.id)),
      })),
      limit,
    });
  }

  if (!mailingAddress) {
    return NextResponse.json({
      error: 'Set EMAIL_MAILING_ADDRESS to a valid physical postal address before sending this marketing campaign.',
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
        subject: 'Love Line just got a serious upgrade',
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
