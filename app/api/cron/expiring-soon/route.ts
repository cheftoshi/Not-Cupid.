import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin';
import { renderEmail, sendEmail, button, C, escapeHtml } from '@/lib/email';
import { sendPushToUser } from '@/lib/push';
import { isAuthorizedCronRequest } from '@/lib/request-security';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';
import {
  claimLoveNotificationEvent,
  loveDashboardUrl,
  markLoveNotificationResult,
  markLoveNotificationSkipped,
  type LoveNotificationType,
} from '@/lib/love-notification-ledger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const HOUR = 60 * 60 * 1000;
const FINAL_MIN_HOURS = 3;
const FINAL_MAX_HOURS = 6;
export const MUTUAL_NUDGE_VERSION = 'love-mutual-no-message-v1-2026-08-18';

type PendingMatch = {
  id: string;
  user_1_id: string;
  user_2_id: string;
  user_1_accepted: boolean;
  user_2_accepted: boolean;
  expires_at: string;
  compatibility_score: number | null;
};

type ReminderKind = 'decision_24h' | 'decision_final';
type ReminderItem = { match: PendingMatch; recipientId: string; otherId: string };
type MutualNoMessageMatch = PendingMatch & {
  created_at: string;
  user_1_accepted_at: string | null;
  user_2_accepted_at: string | null;
};

function unansweredSide(match: PendingMatch): string | null {
  if (match.user_1_accepted && !match.user_2_accepted) return match.user_2_id;
  if (match.user_2_accepted && !match.user_1_accepted) return match.user_1_id;
  return null;
}

function groupItems(kind: ReminderKind, matches: PendingMatch[]): Map<string, ReminderItem[]> {
  const grouped = new Map<string, ReminderItem[]>();
  for (const match of matches) {
    const recipientId = unansweredSide(match);
    if (!recipientId) continue;
    const otherId = recipientId === match.user_1_id ? match.user_2_id : match.user_1_id;
    const key = `${kind}:${recipientId}`;
    grouped.set(key, [...(grouped.get(key) || []), { match, recipientId, otherId }]);
  }
  return grouped;
}

function namesLine(names: string[]): string {
  if (names.length === 1) return `<strong style="color:${C.ink};">${escapeHtml(names[0])}</strong> chose you.`;
  return `<strong style="color:${C.ink};">${names.length} people</strong> chose you: ${names.map(escapeHtml).join(', ')}.`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    const admin = await getCurrentAdmin();
    if (!admin) {
      console.warn('[cron/expiring-soon] 403 — invalid bearer and no admin session');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const twentyFourHoursAgo = new Date(now - 24 * HOUR).toISOString();
    const finalLowerIso = new Date(now + FINAL_MIN_HOURS * HOUR).toISOString();
    const finalUpperIso = new Date(now + FINAL_MAX_HOURS * HOUR).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 24 * HOUR).toISOString();
    const twelveHoursAgo = now - 12 * HOUR;
    const thirtySixHoursAgo = now - 36 * HOUR;
    const mutualNudgeEnabled = process.env.LOVE_MUTUAL_NUDGE_APPROVAL_VERSION === MUTUAL_NUDGE_VERSION;

    const commonCols = 'id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, expires_at, compatibility_score';
    const [{ data: dayMatches, error: dayError }, { data: finalMatches, error: finalError }, mutualRows] = await Promise.all([
      supabaseAdmin
        .from('matches')
        .select(commonCols)
        .eq('status', 'pending')
        .is('ended_at', null)
        .is('decision_reminder_sent_at', null)
        .lte('created_at', twentyFourHoursAgo)
        .gt('expires_at', finalUpperIso)
        .order('created_at', { ascending: true })
        .limit(250),
      supabaseAdmin
        .from('matches')
        .select(commonCols)
        .eq('status', 'pending')
        .is('ended_at', null)
        .is('expiring_reminder_sent_at', null)
        .gte('expires_at', finalLowerIso)
        .lte('expires_at', finalUpperIso)
        .order('expires_at', { ascending: true })
        .limit(250),
      fetchAllSupabaseRows<MutualNoMessageMatch>((from, to) => supabaseAdmin
          .from('matches')
          .select(`${commonCols}, created_at, user_1_accepted_at, user_2_accepted_at`)
          .eq('status', 'both_accepted')
          .is('ended_at', null)
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
        500,
      ),
    ]);
    if (dayError) throw dayError;
    if (finalError) throw finalError;

    const mutualAgeEligible = mutualRows.filter((match) => {
      const mutualAt = Math.max(
        new Date(match.user_1_accepted_at || match.created_at).getTime(),
        new Date(match.user_2_accepted_at || match.created_at).getTime(),
      );
      return mutualAt <= twelveHoursAgo && mutualAt >= thirtySixHoursAgo;
    });
    const mutualIds = mutualAgeEligible.map((match) => match.id);
    const mutualMessages = mutualIds.length
      ? await fetchAllSupabaseRows<{ id: string; match_id: string }>((from, to) => supabaseAdmin
          .from('messages')
          .select('id, match_id')
          .in('match_id', mutualIds)
          .order('id', { ascending: true })
          .range(from, to),
        500,
      )
      : [];
    const messagedIds = new Set((mutualMessages || []).map((message: any) => message.match_id));
    const mutualNoMessage = mutualAgeEligible.filter((match) => !messagedIds.has(match.id));

    const groups = new Map<string, ReminderItem[]>([
      ...groupItems('decision_24h', (dayMatches || []) as PendingMatch[]),
      ...groupItems('decision_final', (finalMatches || []) as PendingMatch[]),
    ]);
    const userIds = Array.from(new Set([
      ...Array.from(groups.values()).flatMap((items) => items.flatMap((item) => [item.recipientId, item.otherId])),
      ...mutualNoMessage.flatMap((match) => [match.user_1_id, match.user_2_id]),
    ]));
    const { data: users, error: usersError } = userIds.length
      ? await supabaseAdmin
          .from('users')
          .select('id, name, email, email_notifications, notifications_paused_at, is_test, deleted_at')
          .in('id', userIds)
      : { data: [], error: null };
    if (usersError) throw usersError;
    const byId = new Map((users || []).map((user: any) => [user.id, user]));

    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
    let emailed = 0;
    let pushed = 0;
    let skipped = 0;
    let mutualNudgeEmailed = 0;
    let mutualNudgePushed = 0;
    const failures: string[] = [];

    for (const [key, items] of groups) {
      const kind = key.startsWith('decision_24h:') ? 'decision_24h' : 'decision_final';
      const type = kind as LoveNotificationType;
      const recipient = byId.get(items[0].recipientId);
      const names = items.map((item) => (byId.get(item.otherId)?.name || 'your match').split(' ')[0]);

      const emailEventIds = (await Promise.all(items.map((item) =>
        claimLoveNotificationEvent({
          matchId: item.match.id,
          recipientId: item.recipientId,
          type,
          channel: 'email',
        })
      ))).filter((id): id is string => !!id);

      const pushEventIds = (await Promise.all(items.map((item) =>
        claimLoveNotificationEvent({
          matchId: item.match.id,
          recipientId: item.recipientId,
          type,
          channel: 'push',
        })
      ))).filter((id): id is string => !!id);

      const firstMatchId = items[0].match.id;
      const dashboardPath = loveDashboardUrl(firstMatchId);
      const isFinal = kind === 'decision_final';
      let handled = false;
      if (emailEventIds.length > 0) {
        if (!recipient?.email || recipient.email_notifications === false || recipient.notifications_paused_at) {
          await markLoveNotificationSkipped(emailEventIds, 'email_unavailable_or_disabled');
          skipped += emailEventIds.length;
          handled = true;
        } else {
          const html = renderEmail({
            preheader: isFinal
              ? `Your Love Line choice closes soon. Choose Yes or Pass.`
              : `You have a Love Line choice waiting. Choose Yes or Pass.`,
            eyebrow: isFinal ? 'your choice closes soon' : 'your move',
            headline: isFinal
              ? `${names.length === 1 ? names[0] : 'Your choices'} won’t wait forever.`
              : `${names.length === 1 ? names[0] : 'Your Love Line choices'} ${names.length === 1 ? 'is' : 'are'} waiting.`,
            bodyHtml: `
              <p style="margin:0 0 12px 0;">${namesLine(names)}</p>
              <p style="margin:0 0 20px 0;">${isFinal
                ? 'Review the profile and choose Yes or Pass before the window closes. Either answer is okay.'
                : 'Review the profile and tap Yes or Pass. There’s no pressure either way; making a choice keeps the Love Line moving.'}</p>
              ${button({ href: `${base}${dashboardPath}`, label: 'Review my Love Line →' })}
            `,
            recipientId: recipient.id,
            footerNote: 'clear choices keep the Love Line moving.',
          });
          const result = await sendEmail({
            to: recipient.email,
            subject: isFinal ? 'Your Love Line choice closes soon' : 'You have a Love Line choice waiting',
            html,
            idempotencyKey: `love-${kind}-${recipient.id}-${items.map((item) => item.match.id).sort().join('-')}`,
            tags: [
              { name: 'category', value: kind },
              { name: 'love_event_id', value: emailEventIds[0] },
            ],
          });
          await markLoveNotificationResult(emailEventIds, result);
          if (result.ok) {
            emailed++;
            handled = true;
          }
          else failures.push(`${kind}:email:${recipient.id}`);
        }
      }

      if (pushEventIds.length > 0) {
        const didPush = await sendPushToUser(items[0].recipientId, {
          title: isFinal ? 'Your Love Line choice closes soon' : 'You have a Love Line choice waiting',
          body: names.length === 1
            ? `${names[0]} chose you. Review their profile and choose Yes or Pass.`
            : `${names.length} people chose you. Review each profile and choose Yes or Pass.`,
          url: loveDashboardUrl(firstMatchId, pushEventIds[0]),
          tag: 'love-decisions',
        });
        if (didPush) {
          await markLoveNotificationResult(pushEventIds, { ok: true });
          pushed++;
          handled = true;
        } else {
          await markLoveNotificationSkipped(pushEventIds, 'push_unavailable');
          skipped += pushEventIds.length;
        }
      }

      // Provider email failures remain retryable after the ledger claim cools
      // down; we only close the match-level reminder gate once some channel
      // succeeded or the user explicitly has no reachable channel.
      if (handled) {
        const marker = isFinal ? 'expiring_reminder_sent_at' : 'decision_reminder_sent_at';
        await supabaseAdmin
          .from('matches')
          .update({ [marker]: nowIso })
          .in('id', items.map((item) => item.match.id));
      }
    }

    // Implemented but fail-closed until the exact versioned email below is
    // approved and the matching production environment variable is set.
    if (mutualNudgeEnabled) {
      for (const match of mutualNoMessage) {
        for (const [recipientId, otherId] of [[match.user_1_id, match.user_2_id], [match.user_2_id, match.user_1_id]]) {
          const recipient = byId.get(recipientId);
          const other = byId.get(otherId);
          if (!recipient || recipient.deleted_at || recipient.is_test === true || !other) continue;
          const first = (other.name || 'your match').split(' ')[0];
          const type: LoveNotificationType = 'mutual_no_message_12h';
          const [emailEventId, pushEventId] = await Promise.all([
            claimLoveNotificationEvent({ matchId: match.id, recipientId, type, channel: 'email' }),
            claimLoveNotificationEvent({ matchId: match.id, recipientId, type, channel: 'push' }),
          ]);

          if (emailEventId) {
            if (!recipient.email || recipient.email_notifications === false || recipient.notifications_paused_at) {
              await markLoveNotificationSkipped([emailEventId], 'email_unavailable_or_disabled');
            } else {
              const result = await sendEmail({
                to: recipient.email,
                subject: `You matched with ${first}`,
                html: renderEmail({
                  preheader: `You both said yes. Send a simple first message when you’re ready.`,
                  bodyHtml: `<p style="margin:0 0 18px 0;">Start with something simple from their profile. If you need a little inspiration, the AI Connect Coach can help.</p>${button({ href: `${base}/match/${match.id}`, label: `Say hello to ${escapeHtml(first)} →` })}`,
                  recipientId,
                }),
                idempotencyKey: `love-mutual-no-message-12h-${match.id}-${recipientId}`,
                tags: [
                  { name: 'category', value: 'mutual_no_message_12h' },
                  { name: 'love_event_id', value: emailEventId },
                ],
              });
              await markLoveNotificationResult([emailEventId], result);
              if (result.ok) mutualNudgeEmailed++;
              else failures.push(`mutual_no_message_12h:email:${recipientId}`);
            }
          }

          if (pushEventId) {
            const didPush = await sendPushToUser(recipientId, {
              title: `Your match with ${first} is ready`,
              body: 'The chat is open. Start with one real question.',
              url: `/match/${match.id}?love_event=${pushEventId}`,
              tag: `match-${match.id}`,
            });
            if (didPush) {
              await markLoveNotificationResult([pushEventId], { ok: true });
              mutualNudgePushed++;
            } else {
              await markLoveNotificationSkipped([pushEventId], 'push_unavailable');
            }
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      due24h: dayMatches?.length || 0,
      dueFinal: finalMatches?.length || 0,
      recipients: groups.size,
      emailed,
      pushed,
      skipped,
      failures: failures.slice(0, 8),
      mutualNoMessage12h: {
        version: MUTUAL_NUDGE_VERSION,
        enabled: mutualNudgeEnabled,
        dueMatches: mutualNoMessage.length,
        emailed: mutualNudgeEmailed,
        pushed: mutualNudgePushed,
      },
    });
  } catch (err: any) {
    console.error('cron/expiring-soon error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
