import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin';
import { renderEmail, sendEmail, button, C } from '@/lib/email';
import { signMatchToken } from '@/lib/match-tokens';
import { sendPushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Window: a match enters this cron's range when its expires_at is between
// WINDOW_MIN_HOURS and WINDOW_MAX_HOURS from now. We send a single
// "X hours left" reminder to whichever side hasn't accepted, and
// `expiring_reminder_sent_at` prevents double-sends.
//
// Cadence: on Vercel Pro this runs HOURLY (vercel.json: "0 * * * *"), so a
// tight 3-6h window gives an accurate "~4 hours left" nudge — a match
// passes through the band over a few hourly ticks and gets exactly one
// reminder. (On Hobby this had to widen to ~26h with a daily run.)
const WINDOW_MIN_HOURS = 3;
const WINDOW_MAX_HOURS = 6;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const userAgent = req.headers.get('user-agent') || '';
  const bearerOk = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  // Fallback: Vercel's scheduler always sends this UA on cron invocations,
  // even when CRON_SECRET isn't wired through to the runtime env.
  const vercelCronUA = /vercel-cron/i.test(userAgent);
  const isVercelCron = bearerOk || vercelCronUA;

  if (!isVercelCron) {
    const admin = await getCurrentAdmin();
    if (!admin) {
      console.warn('[cron/expiring-soon] 403 — not cron and not admin', {
        hasCronSecret: !!cronSecret,
        gotAuthHeader: !!authHeader,
        ua: userAgent.slice(0, 40),
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const now = Date.now();
    const lowerIso = new Date(now + WINDOW_MIN_HOURS * 3600_000).toISOString();
    const upperIso = new Date(now + WINDOW_MAX_HOURS * 3600_000).toISOString();

    // Find pending matches with expires_at in the window and no reminder sent.
    const { data: matches, error } = await supabaseAdmin
      .from('matches')
      .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, expires_at, compatibility_score')
      .eq('status', 'pending')
      .is('expiring_reminder_sent_at', null)
      .gte('expires_at', lowerIso)
      .lte('expires_at', upperIso);

    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const m of matches || []) {
      // Determine which side(s) still need to accept.
      const needsUser1 = !m.user_1_accepted;
      const needsUser2 = !m.user_2_accepted;
      const recipientIds: string[] = [];
      if (needsUser1) recipientIds.push(m.user_1_id);
      if (needsUser2) recipientIds.push(m.user_2_id);
      if (recipientIds.length === 0) {
        skipped++;
        continue;
      }

      // Bulk-fetch the two users.
      const ids = Array.from(new Set([m.user_1_id, m.user_2_id]));
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, name, email, email_notifications')
        .in('id', ids);
      const byId = new Map((users ?? []).map((u: any) => [u.id, u]));

      const hoursLeft = Math.max(1, Math.round((new Date(m.expires_at).getTime() - now) / 3600_000));

      for (const recipientId of recipientIds) {
        const recipient = byId.get(recipientId);
        const otherId = recipientId === m.user_1_id ? m.user_2_id : m.user_1_id;
        const other = byId.get(otherId);
        if (!recipient?.email) continue;
        if (recipient.email_notifications === false) continue;

        const acceptToken = signMatchToken({ matchId: m.id, userId: recipient.id, action: 'accept' });
        const passToken = signMatchToken({ matchId: m.id, userId: recipient.id, action: 'pass' });
        const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
        const acceptUrl = `${base}/api/match-accept?matchId=${m.id}&userId=${recipient.id}&token=${acceptToken}`;
        const passUrl = `${base}/api/match-pass?matchId=${m.id}&userId=${recipient.id}&token=${passToken}`;

        const otherFirst = (other?.name || 'your match').split(' ')[0];

        const html = renderEmail({
          preheader: `Only ${hoursLeft} hours left to decide on ${otherFirst}. After that they go back in the pool.`,
          eyebrow: `${hoursLeft} hours left`,
          headline: `Don't ghost ${otherFirst}.`,
          bodyHtml: `
            <p style="margin:0 0 12px 0;">
              Your ${m.compatibility_score ?? '—'}% match with <strong style="color:${C.ink};">${otherFirst}</strong> expires in about <strong style="color:${C.ink};">${hoursLeft} hours</strong>. If you don't say yes or no, the match drops and you both go back in the pool.
            </p>
            <p style="margin:0 0 22px 0;">
              No pressure to commit to coffee — just commit to a decision.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="padding-right:10px;">${button({ href: acceptUrl, label: "Yes, I'm in →" })}</td>
              <td>${button({ href: passUrl, label: 'Pass', variant: 'secondary' })}</td>
            </tr></table>
          `,
          recipientId: recipient.id,
          footerNote: `match windows close so the pool stays fresh.`,
        });

        const result = await sendEmail({
          to: recipient.email,
          subject: `${hoursLeft}h left to decide on ${otherFirst} — NotCupid`,
          html,
        });

        if (result.ok) sent++;
        else failures.push(`${recipient.id}: ${result.error}`);

        // Push alongside the email — people miss the email, and a decision
        // before expiry is exactly what the responsiveness gate rewards.
        await sendPushToUser(recipient.id, {
          title: `${hoursLeft}h left with ${otherFirst}`,
          body: 'Say yes or pass before the match drops back into the pool.',
          url: '/dashboard',
          tag: `match-${m.id}`,
        }).catch(() => {});
      }

      // Mark the match as reminded so the next cron tick doesn't re-send.
      await supabaseAdmin
        .from('matches')
        .update({ expiring_reminder_sent_at: new Date().toISOString() })
        .eq('id', m.id);
    }

    return NextResponse.json({
      ok: true,
      candidates: matches?.length ?? 0,
      sent,
      skipped,
      failures: failures.slice(0, 5),
    });
  } catch (err: any) {
    console.error('cron/expiring-soon error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
