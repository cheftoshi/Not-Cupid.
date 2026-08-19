// Shared match-acceptance logic so the email link (/api/match-accept) and the
// in-app button (/api/matches/[id]/accept) activate a match IDENTICALLY.
//
// Behavior:
//   - records the accepting user's `user_X_accepted`
//   - FIRST accept → email the other person an "interested, accept to connect" nudge
//   - BOTH accepted → full activation: status='both_accepted', open the chat with
//     a 36h inactivity window (chat_expires_at), and notify both without exposing
//     either login email. Idempotent — re-calling after mutual accept is a no-op.

import { supabaseAdmin } from '@/lib/supabase';
import { renderEmail, sendEmail, button, C, escapeHtml } from '@/lib/email';
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
  const nowIso = new Date(nowMs).toISOString();
  const { data: matches, error: matchReadError } = await supabaseAdmin
    .from('matches')
    .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, expires_at, status')
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .is('ended_at', null)
    .neq('status', 'expired');
  if (matchReadError) throw matchReadError;
  for (const m of matches ?? []) {
    const both = m.user_1_accepted && m.user_2_accepted;
    if (both) continue;
    if (!m.expires_at || new Date(m.expires_at).getTime() >= nowMs) continue;
    // Timed out without a mutual accept → expire it and free both parties.
    // Compare-and-set is the claim. Concurrent cron/roster requests may read
    // the same due row, but only one can transition it and run side effects.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('matches')
      .update({ status: 'expired', ended_at: new Date().toISOString(), ended_reason: 'expired' })
      .eq('id', m.id)
      .is('ended_at', null)
      .lt('expires_at', nowIso)
      .or('user_1_accepted.eq.false,user_2_accepted.eq.false')
      .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted')
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;
    await recordLoveExpiry(claimed.id, [
      ...(!claimed.user_1_accepted ? [claimed.user_1_id] : []),
      ...(!claimed.user_2_accepted ? [claimed.user_2_id] : []),
    ]);
    await returnLovePickEntitlement(claimed.id, null);
    await supabaseAdmin.from('users').update({ status: 'waiting' }).in('id', [claimed.user_1_id, claimed.user_2_id]);
    // Whoever got picked here and never accepted accrues an "ignored pick".
    const ignorer = ignoringParty(claimed);
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
  const { data, error } = await supabaseAdmin.rpc('accept_love_match', {
    p_match_id: matchId,
    p_user_id: userId,
    p_max_connections: MAX_CONNECTIONS,
    p_chat_expires_at: new Date(Date.now() + CHAT_INACTIVITY_MS).toISOString(),
  });
  if (error) throw error;
  const transition = (Array.isArray(data) ? data[0] : data) as {
    outcome: 'not_found' | 'not_party' | 'ended' | 'expired' | 'at_capacity'
      | 'already_mutual' | 'already_first' | 'accepted_first' | 'accepted_mutual';
    participant_1_id: string | null;
    participant_2_id: string | null;
    participant_1_accepted: boolean;
    participant_2_accepted: boolean;
  } | null;
  if (!transition) throw new Error('Love acceptance did not return a transition.');

  if (transition.outcome === 'not_found') return { ok: false, reason: 'not_found' };
  if (transition.outcome === 'not_party') return { ok: false, reason: 'not_party' };
  if (transition.outcome === 'at_capacity') return { ok: false, reason: 'at_capacity' };
  const participantIds = [transition.participant_1_id, transition.participant_2_id]
    .filter((id): id is string => !!id);
  if (transition.outcome === 'expired') {
    await recordLoveExpiry(matchId, [
      ...(!transition.participant_1_accepted && transition.participant_1_id ? [transition.participant_1_id] : []),
      ...(!transition.participant_2_accepted && transition.participant_2_id ? [transition.participant_2_id] : []),
    ]);
    await returnLovePickEntitlement(matchId, null);
    return { ok: false, reason: 'ended' };
  }
  if (transition.outcome === 'ended') return { ok: false, reason: 'ended' };

  // Already mutually accepted → idempotent success (don't re-send emails).
  if (transition.outcome === 'already_mutual') {
    await syncMatchRosters(participantIds);
    return { ok: true, mutual: true, already: true };
  }
  if (transition.outcome === 'already_first') return { ok: true, mutual: false, already: true };
  await recordLoveDecision(matchId, userId, 'accepted');

  if (transition.outcome === 'accepted_mutual') {
    await syncMatchRosters(participantIds);

    await sendItsAMatchEmails(matchId, participantIds[0], participantIds[1]).catch((e) =>
      console.error('acceptMatch: its-a-match email failed', e)
    );
    // Push to both — every provider attempt is claimed before it leaves so a
    // retry can never produce duplicate lock-screen alerts.
    await Promise.all(participantIds.map(async (recipientId) => {
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
  const otherId = transition.participant_1_id === userId
    ? transition.participant_2_id
    : transition.participant_1_id;
  if (!otherId) throw new Error('Love acceptance is missing the other participant.');
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
  const html = (otherName: string, recipientId: string) =>
    renderEmail({
      preheader: `Both of you said yes. Your chat with ${otherName.split(' ')[0]} is open.`,
      eyebrow: "it's a match ✦",
      headline: `${otherName.split(' ')[0]} said yes too.`,
      bodyHtml: `
        <p style="margin:0 0 14px 0;">The algo lit the spark; the rest is on you. Your private chat is open in the app.</p>
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
      subject: `${other.name.split(' ')[0]} said yes — your chat is open`,
      html: html(other.name, recipient.id),
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
