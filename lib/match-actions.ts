// Shared match-acceptance logic so the email link (/api/match-accept) and the
// in-app button (/api/matches/[id]/accept) activate a match IDENTICALLY.
//
// Behavior:
//   - records the accepting user's `user_X_accepted`
//   - FIRST accept → email the other person an "interested, accept to connect" nudge
//   - BOTH accepted → full activation: status='both_accepted', open the chat with
//     a 24h inactivity window (chat_expires_at), and email both the "it's a match"
//     contact card. Idempotent — re-calling after mutual accept is a no-op.

import { supabaseAdmin } from '@/lib/supabase';
import { renderEmail, sendEmail, infoCard, button, C, escapeHtml } from '@/lib/email';
import { sendPushToUser } from '@/lib/push';
import { LOVE_MAX_CONNECTIONS } from '@/lib/matching-policy';
import { returnLovePickEntitlement } from '@/lib/love-pick-access';
import {
  claimLoveNotificationEvent,
  loveDashboardUrl,
  markLoveNotificationResult,
  markLoveNotificationSkipped,
  recordLoveDecision,
  recordLoveExpiry,
} from '@/lib/love-notification-ledger';

// Ten is a hard safety ceiling, not the free allowance. Each daily roster has
// three included outgoing picks; extras are paid individually or included with
// Pro. Pending picks reserve capacity so availability stays honest.
// "Live" = both-accepted, or pending within the accept window.
export const MAX_CONNECTIONS = LOVE_MAX_CONNECTIONS;

// Responsiveness gate. Each time a user gets PICKED (a pending match waiting on
// them) and lets it EXPIRE without ever accepting, their `ignored_picks` ticks
// up. Once it exceeds MAX_IGNORED_PICKS they're benched from everyone's roster —
// the pool stops wasting picks on a chronic no-show. Resets to 0 the moment they
// accept (or pre-accept by picking) any match. This is the #1 pool-failure mode:
// picks landing on people who never respond.
export const MAX_IGNORED_PICKS = 3;

/** A pending match's NON-accepting party (the picked side that hasn't said yes),
 *  but only if the OTHER side actually accepted (a real pick that got ignored). */
export function ignoringParty(m: any): string | null {
  if (!m.user_1_accepted && m.user_2_accepted) return m.user_1_id;
  if (!m.user_2_accepted && m.user_1_accepted) return m.user_2_id;
  return null;
}

/** Is this match row currently live (not ended/expired, and still in window)? */
export function isMatchLive(m: any, nowMs: number = Date.now()): boolean {
  if (!m || m.ended_at) return false;
  if (['ended', 'passed', 'expired'].includes(m.status)) return false;
  if (m.user_1_accepted && m.user_2_accepted) return true; // both accepted → active chat
  return !m.expires_at || new Date(m.expires_at).getTime() >= nowMs; // pending, still in window
}

/** All of a user's currently-live matches (pending-in-window OR both-accepted). */
export async function liveMatchesFor(userId: string): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from('matches')
    .select('*')
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .is('ended_at', null)
    .neq('status', 'expired');
  const now = Date.now();
  return (data ?? []).filter((m) => isMatchLive(m, now));
}

/**
 * Remove the newly-created pair from each other's saved roster. A user stays
 * visible to everyone else until the live safety ceiling is filled; at
 * capacity the database removes them from every saved roster in one operation.
 */
export async function syncMatchRosters(userIds: string[]): Promise<void> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin.rpc('sync_match_rosters', {
    p_user_ids: ids,
    p_max_connections: MAX_CONNECTIONS,
  });
  if (error) console.error('syncMatchRosters failed', error.message);
}

// Lazily expire a user's timed-out pending matches and return both parties to
// the pool. The cron does this every 20 min, but roster/pick call this on
// demand so a just-timed-out user can immediately pick again (no 20-min limbo
// where their status is still 'matched'). Idempotent.
export async function releaseTimedOutMatches(userId: string): Promise<void> {
  const nowMs = Date.now();
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, expires_at, status')
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .is('ended_at', null)
    .neq('status', 'expired');
  for (const m of matches ?? []) {
    const both = m.user_1_accepted && m.user_2_accepted;
    if (both) continue;
    if (!m.expires_at || new Date(m.expires_at).getTime() >= nowMs) continue;
    // Timed out without a mutual accept → expire it and free both parties.
    await supabaseAdmin
      .from('matches')
      .update({ status: 'expired', ended_at: new Date().toISOString(), ended_reason: 'expired' })
      .eq('id', m.id);
    await recordLoveExpiry(m.id, [
      ...(!m.user_1_accepted ? [m.user_1_id] : []),
      ...(!m.user_2_accepted ? [m.user_2_id] : []),
    ]);
    await returnLovePickEntitlement(m.id, null);
    await supabaseAdmin.from('users').update({ status: 'waiting' }).in('id', [m.user_1_id, m.user_2_id]);
    // Whoever got picked here and never accepted accrues an "ignored pick".
    const ignorer = ignoringParty(m);
    if (ignorer) await supabaseAdmin.rpc('bump_ignored_picks', { p_id: ignorer }).then(undefined, () => {});
  }
}

// Chat expires after this much SILENCE. Each new message slides it forward
// (see /api/messages). An active conversation therefore never expires.
export const CHAT_INACTIVITY_MS = 36 * 60 * 60 * 1000;

export type AcceptResult =
  | { ok: false; reason: 'not_found' | 'not_party' | 'ended' | 'at_capacity' }
  | { ok: true; mutual: boolean; already?: boolean };

export async function acceptMatch(matchId: string, userId: string): Promise<AcceptResult> {
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (!match) return { ok: false, reason: 'not_found' };

  const isUser1 = match.user_1_id === userId;
  const isUser2 = match.user_2_id === userId;
  if (!isUser1 && !isUser2) return { ok: false, reason: 'not_party' };
  if (match.ended_at || ['ended', 'passed', 'expired'].includes(match.status)) {
    return { ok: false, reason: 'ended' };
  }
  if (match.expires_at && new Date(match.expires_at) <= new Date()) {
    await supabaseAdmin
      .from('matches')
      .update({ status: 'expired', ended_at: new Date().toISOString(), ended_reason: 'expired' })
      .eq('id', matchId)
      .eq('status', 'pending');
    await recordLoveExpiry(matchId, [
      ...(!match.user_1_accepted ? [match.user_1_id] : []),
      ...(!match.user_2_accepted ? [match.user_2_id] : []),
    ]);
    await returnLovePickEntitlement(matchId, null);
    return { ok: false, reason: 'ended' };
  }

  // Already mutually accepted → idempotent success (don't re-send emails).
  if (match.user_1_accepted && match.user_2_accepted) {
    await syncMatchRosters([match.user_1_id, match.user_2_id]);
    return { ok: true, mutual: true, already: true };
  }

  // Capacity guard: pick gates the PICKER, but a candidate can accrue extra
  // pendings via the double-pick race ("extra suitor"). Accepting must not push
  // anyone past MAX_CONNECTIONS — count their OTHER live matches (this pending
  // already counts as live, so exclude it) and block at the cap.
  const live = await liveMatchesFor(userId);
  const othersLive = live.filter((m: any) => m.id !== matchId);
  if (othersLive.length >= MAX_CONNECTIONS) {
    return { ok: false, reason: 'at_capacity' };
  }

  const field = isUser1 ? 'user_1_accepted' : 'user_2_accepted';
  const acceptedAtField = isUser1 ? 'user_1_accepted_at' : 'user_2_accepted_at';
  const otherAccepted = isUser1 ? match.user_2_accepted : match.user_1_accepted;

  // Record this user's acceptance.
  await supabaseAdmin
    .from('matches')
    .update({ [field]: true, [acceptedAtField]: new Date().toISOString() })
    .eq('id', matchId);
  await recordLoveDecision(matchId, userId, 'accepted');

  // Re-engaged → clear any "ignored picks" bench (covers both accepting an
  // incoming pick and pre-accepting your own pick). No-op if column unmigrated.
  await supabaseAdmin.from('users').update({ ignored_picks: 0 }).eq('id', userId).then(undefined, () => {});

  if (otherAccepted) {
    // Mutual → full activation.
    await supabaseAdmin
      .from('matches')
      .update({
        status: 'both_accepted',
        chat_expires_at: new Date(Date.now() + CHAT_INACTIVITY_MS).toISOString(),
      })
      .eq('id', matchId);

    await syncMatchRosters([match.user_1_id, match.user_2_id]);

    await sendItsAMatchEmails(matchId, match.user_1_id, match.user_2_id).catch((e) =>
      console.error('acceptMatch: its-a-match email failed', e)
    );
    // Push to both — every provider attempt is claimed before it leaves so a
    // retry can never produce duplicate lock-screen alerts.
    await Promise.all([match.user_1_id, match.user_2_id].map(async (recipientId) => {
      const eventId = await claimLoveNotificationEvent({
        matchId,
        recipientId,
        type: 'mutual',
        channel: 'push',
      });
      if (!eventId) return;
      const pushed = await sendPushToUser(recipientId, {
        title: "It's a match ✦",
        body: 'Both of you said yes — the chat is open.',
        url: `/match/${matchId}?love_event=${eventId}`,
        tag: `match-${matchId}`,
      });
      await markLoveNotificationResult([eventId], {
        ok: pushed,
        error: pushed ? undefined : 'push_unavailable',
      });
    }));
    return { ok: true, mutual: true };
  }

  // First to accept → nudge the other person.
  const otherId = isUser1 ? match.user_2_id : match.user_1_id;
  let accepterFirst = 'Someone';
  try {
    accepterFirst = await sendInterestNudge(matchId, otherId, userId);
  } catch (e) {
    console.error('acceptMatch: interest nudge failed', e);
  }
  const pushEventId = await claimLoveNotificationEvent({
    matchId,
    recipientId: otherId,
    type: 'interest_immediate',
    channel: 'push',
  });
  const pushed = pushEventId ? await sendPushToUser(otherId, {
    title: `${accepterFirst} chose you 👀`,
    body: 'Review their profile, then choose Yes or Pass.',
    url: loveDashboardUrl(matchId, pushEventId),
    tag: `match-${matchId}`,
  }) : false;
  if (pushEventId) {
    await markLoveNotificationResult([pushEventId], {
      ok: pushed,
      error: pushed ? undefined : 'push_unavailable',
    });
  }
  return { ok: true, mutual: false };
}

async function sendItsAMatchEmails(matchId: string, user1Id: string, user2Id: string) {
  const { data: user1 } = await supabaseAdmin.from('users').select('id, name, email').eq('id', user1Id).single();
  const { data: user2 } = await supabaseAdmin.from('users').select('id, name, email').eq('id', user2Id).single();
  if (!user1 || !user2) return;

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const html = (otherName: string, otherEmail: string, recipientId: string) =>
    renderEmail({
      preheader: `Both of you said yes. Your chat with ${otherName.split(' ')[0]} is open.`,
      eyebrow: "it's a match ✦",
      headline: `${otherName.split(' ')[0]} said yes too.`,
      bodyHtml: `
        <p style="margin:0 0 14px 0;">The algo lit the spark; the rest is on you. Chat's open in the app, and here's their email so you can take it wherever feels right.</p>
        ${infoCard({ eyebrow: `${otherName}'s email`, big: otherEmail })}
        <p style="margin:14px 0 6px 0;color:${C.ink};font-size:15px;font-weight:500;">A nudge, not a script:</p>
        <ul style="margin:0 0 18px 0;padding-left:18px;font-size:14px;color:${C.muted};line-height:1.7;">
          <li>Message soon — the chat closes after 36 quiet hours (every message resets the clock).</li>
          <li>Make the first message a real one, not "hey." You both already passed the hard part.</li>
          <li>If it lands, come back and tell us how it went.</li>
        </ul>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper};border:1px solid ${C.border};border-radius:10px;margin:0 0 18px 0;"><tr><td style="padding:12px 16px;">
          <div style="font-family:'DM Mono','SF Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${C.lav};margin-bottom:6px;">first date? play it smart</div>
          <div style="font-size:13px;color:${C.muted};line-height:1.6;">Meet somewhere public, tell a friend where you'll be, and arrange your own ride. Trust your gut — if something feels off, you owe nothing. (You can report anyone from the match.)</div>
        </td></tr></table>
        ${button({ href: `${base}/match/${matchId}`, label: 'Open chat & profile →' })}
      `,
      recipientId,
      footerNote: 'mutual yes. you earned this one.',
    });

  await Promise.all([
    [user1, user2],
    [user2, user1],
  ].map(async ([recipient, other]) => {
    const eventId = await claimLoveNotificationEvent({
      matchId,
      recipientId: recipient.id,
      type: 'mutual',
      channel: 'email',
    });
    if (!eventId) return;
    if (!recipient.email) {
      await markLoveNotificationSkipped([eventId], 'email_unavailable');
      return;
    }
    const result = await sendEmail({
      to: recipient.email,
      subject: `${other.name.split(' ')[0]} said yes — here's their email`,
      html: html(other.name, other.email, recipient.id),
      idempotencyKey: `mutual-match-${matchId}-${recipient.id}`,
      tags: [
        { name: 'category', value: 'mutual_match' },
        { name: 'love_event_id', value: eventId },
      ],
    });
    await markLoveNotificationResult([eventId], result);
  }));
}

async function sendInterestNudge(matchId: string, otherId: string, accepterId: string): Promise<string> {
  const [{ data: other }, { data: accepter }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, name, email, email_notifications')
      .eq('id', otherId)
      .single(),
    supabaseAdmin
      .from('users')
      .select('name')
      .eq('id', accepterId)
      .single(),
  ]);
  const accepterFirst = (accepter?.name || 'your match').split(' ')[0];
  const eventId = await claimLoveNotificationEvent({
    matchId,
    recipientId: otherId,
    type: 'interest_immediate',
    channel: 'email',
  });
  if (!eventId) return accepterFirst;
  // Email can be disabled independently; the caller still uses the resolved
  // first name for web push on subscribed devices.
  if (!other?.email || other.email_notifications === false) {
    await markLoveNotificationSkipped([eventId], 'email_unavailable_or_disabled');
    return accepterFirst;
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';

  const html = renderEmail({
    preheader: `${accepterFirst} chose you. Review their profile and choose Yes or Pass.`,
    eyebrow: 'someone said yes',
    headline: `${accepterFirst} is interested in you.`,
    bodyHtml: `
      <p style="margin:0 0 18px 0;">They chose you on NotCupid. Review their profile and choose Yes or Pass — either answer keeps the Love Line moving.</p>
      ${button({ href: `${base}${loveDashboardUrl(matchId)}`, label: 'Review my Love Line →' })}
    `,
    recipientId: otherId,
    footerNote: 'one yes away.',
  });

  const result = await sendEmail({
    to: other.email,
    subject: `${accepterFirst} is interested — your move`,
    html,
    idempotencyKey: `match-interest-${matchId}-${other.id}`,
    tags: [
      { name: 'category', value: 'match_interest' },
      { name: 'love_event_id', value: eventId },
    ],
  });
  await markLoveNotificationResult([eventId], result);
  return accepterFirst;
}
