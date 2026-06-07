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
import { signMatchToken } from '@/lib/match-tokens';
import { renderEmail, sendEmail, infoCard, button, C } from '@/lib/email';

// How many live conversations a user can run at once. The product stays
// curated (not a swipe feed), but you no longer have to drop one match to
// consider another. "Live" = both-accepted, or pending within the accept window.
export const MAX_CONNECTIONS = 3;

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
    await supabaseAdmin.from('users').update({ status: 'waiting' }).in('id', [m.user_1_id, m.user_2_id]);
  }
}

// Chat expires after this much SILENCE. Each new message slides it forward
// (see /api/messages). An active conversation therefore never expires.
export const CHAT_INACTIVITY_MS = 36 * 60 * 60 * 1000;

export type AcceptResult =
  | { ok: false; reason: 'not_found' | 'not_party' | 'ended' }
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

  // Already mutually accepted → idempotent success (don't re-send emails).
  if (match.user_1_accepted && match.user_2_accepted) {
    return { ok: true, mutual: true, already: true };
  }

  const field = isUser1 ? 'user_1_accepted' : 'user_2_accepted';
  const otherAccepted = isUser1 ? match.user_2_accepted : match.user_1_accepted;

  // Record this user's acceptance.
  await supabaseAdmin.from('matches').update({ [field]: true }).eq('id', matchId);

  if (otherAccepted) {
    // Mutual → full activation.
    await supabaseAdmin
      .from('matches')
      .update({
        status: 'both_accepted',
        chat_expires_at: new Date(Date.now() + CHAT_INACTIVITY_MS).toISOString(),
      })
      .eq('id', matchId);

    await sendItsAMatchEmails(match.user_1_id, match.user_2_id).catch((e) =>
      console.error('acceptMatch: its-a-match email failed', e)
    );
    return { ok: true, mutual: true };
  }

  // First to accept → nudge the other person.
  const otherId = isUser1 ? match.user_2_id : match.user_1_id;
  await sendInterestNudge(matchId, otherId, userId).catch((e) =>
    console.error('acceptMatch: interest nudge failed', e)
  );
  return { ok: true, mutual: false };
}

async function sendItsAMatchEmails(user1Id: string, user2Id: string) {
  const { data: user1 } = await supabaseAdmin.from('users').select('*').eq('id', user1Id).single();
  const { data: user2 } = await supabaseAdmin.from('users').select('*').eq('id', user2Id).single();
  if (!user1 || !user2) return;

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const html = (otherName: string, otherEmail: string, recipientId: string) =>
    renderEmail({
      preheader: `Both of you said yes. ${otherName.split(' ')[0]}'s email is inside — reach out.`,
      eyebrow: "it's a match ✦",
      headline: `${otherName.split(' ')[0]} said yes too.`,
      bodyHtml: `
        <p style="margin:0 0 14px 0;">The algo lit the spark; the rest is on you. Chat's open in the app, and here's their email so you can take it wherever feels right.</p>
        ${infoCard({ eyebrow: `${otherName}'s email`, big: otherEmail })}
        <p style="margin:14px 0 6px 0;color:${C.ink};font-size:15px;font-weight:500;">A nudge, not a script:</p>
        <ul style="margin:0 0 18px 0;padding-left:18px;font-size:14px;color:${C.muted};line-height:1.7;">
          <li>Message in the next day — the chat goes quiet if neither of you speaks for 24h.</li>
          <li>Make the first message a real one, not "hey." You both already passed the hard part.</li>
          <li>If it lands, come back and tell us how it went.</li>
        </ul>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper};border:1px solid ${C.border};border-radius:10px;margin:0 0 18px 0;"><tr><td style="padding:12px 16px;">
          <div style="font-family:'DM Mono','SF Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${C.lav};margin-bottom:6px;">first date? play it smart</div>
          <div style="font-size:13px;color:${C.muted};line-height:1.6;">Meet somewhere public, tell a friend where you'll be, and arrange your own ride. Trust your gut — if something feels off, you owe nothing. (You can report anyone from the match.)</div>
        </td></tr></table>
        ${button({ href: `${base}/dashboard`, label: 'Open the chat →' })}
      `,
      recipientId,
      footerNote: 'mutual yes. you earned this one.',
    });

  await Promise.all([
    sendEmail({
      to: user1.email,
      subject: `${user2.name.split(' ')[0]} said yes — here's their email`,
      html: html(user2.name, user2.email, user1.id),
    }),
    sendEmail({
      to: user2.email,
      subject: `${user1.name.split(' ')[0]} said yes — here's their email`,
      html: html(user1.name, user1.email, user2.id),
    }),
  ]);
}

async function sendInterestNudge(matchId: string, otherId: string, accepterId: string) {
  const { data: other } = await supabaseAdmin
    .from('users')
    .select('id, name, email, email_notifications')
    .eq('id', otherId)
    .single();
  if (!other?.email || other.email_notifications === false) return;

  const { data: accepter } = await supabaseAdmin
    .from('users')
    .select('name')
    .eq('id', accepterId)
    .single();
  const accepterFirst = (accepter?.name || 'your match').split(' ')[0];

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const acceptToken = signMatchToken({ matchId, userId: otherId, action: 'accept' });
  const acceptUrl = `${base}/api/match-accept?matchId=${matchId}&userId=${otherId}&token=${acceptToken}`;

  const html = renderEmail({
    preheader: `${accepterFirst} is interested. Say yes back and you're connected.`,
    eyebrow: 'someone said yes',
    headline: `${accepterFirst} is interested in you.`,
    bodyHtml: `
      <p style="margin:0 0 18px 0;">They tapped yes on your match. Say yes back and the chat opens instantly — you'll both get each other's email too.</p>
      ${button({ href: acceptUrl, label: "Yes, I'm interested →" })}
      <p style="margin:16px 0 0 0;font-size:13px;color:${C.muted};">Not feeling it? No action needed — the match expires on its own.</p>
    `,
    recipientId: otherId,
    footerNote: 'one yes away.',
  });

  await sendEmail({
    to: other.email,
    subject: `${accepterFirst} is interested — your move`,
    html,
  });
}
