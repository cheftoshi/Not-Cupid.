import { supabaseAdmin } from '@/lib/supabase';
import { renderEmail, sendEmail, button } from '@/lib/email';

// Shared Friend Line digest — used by the daily cron and the admin "send now"
// button. Emails friend-opted-in (real, opted-in, not-unsubscribed) users a
// roundup of what's coming up + fresh posts. Only fires when there's something
// to report. The cron throttles per-user to ~20h; the admin send ignores that.

const DIGEST_THROTTLE_MS = 20 * 60 * 60 * 1000;

function esc(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmtWhen(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' });
}

export type DigestResult = { sent: number; candidates: number; events: number; posts: number; reason?: string };

export async function runFriendDigest(opts: { dry?: boolean; ignoreThrottle?: boolean } = {}): Promise<DigestResult> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const dayAgoIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  // Upcoming events (not yet happened, not expired) + posts from the last 24h.
  const { data: acts } = await supabaseAdmin
    .from('friend_activities')
    .select('id, title, kind, area, happens_at, created_at, author_id, expires_at')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(120);

  // Exclude test-authored activities from the real-user digest.
  const authorIds = Array.from(new Set((acts ?? []).map((a) => a.author_id)));
  const { data: authors } = await supabaseAdmin
    .from('users').select('id, is_test').in('id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']);
  const testAuthor = new Set((authors ?? []).filter((u: any) => u.is_test).map((u: any) => u.id));
  const real = (acts ?? []).filter((a) => !testAuthor.has(a.author_id));

  const upcoming = real
    .filter((a) => (a.kind || 'event') === 'event' && a.happens_at && new Date(a.happens_at).getTime() > now)
    .sort((a, b) => new Date(a.happens_at!).getTime() - new Date(b.happens_at!).getTime())
    .slice(0, 8);
  const recentPosts = real
    .filter((a) => (a.kind || 'event') === 'post' && a.created_at >= dayAgoIso)
    .slice(0, 6);

  if (upcoming.length === 0 && recentPosts.length === 0) {
    return { sent: 0, candidates: 0, events: 0, posts: 0, reason: 'nothing to report' };
  }

  // "going" counts for the upcoming events.
  const evIds = upcoming.map((e) => e.id);
  const { data: yesRows } = evIds.length
    ? await supabaseAdmin.from('friend_activity_rsvps').select('activity_id').eq('response', 'yes').in('activity_id', evIds)
    : { data: [] as any[] };
  const yesBy = new Map<string, number>();
  (yesRows ?? []).forEach((r: any) => yesBy.set(r.activity_id, (yesBy.get(r.activity_id) || 0) + 1));

  // Recipients: real, opted-in, not unsubscribed; throttled unless overridden.
  const { data: recips } = await supabaseAdmin
    .from('users')
    .select('id, email, email_notifications, friend_digest_sent_at')
    .not('friend_opted_in_at', 'is', null)
    .is('deleted_at', null)
    .or('is_test.is.null,is_test.eq.false');
  const targets = (recips ?? []).filter((u: any) =>
    u.email && u.email_notifications !== false &&
    (opts.ignoreThrottle || !u.friend_digest_sent_at || now - new Date(u.friend_digest_sent_at).getTime() > DIGEST_THROTTLE_MS)
  );

  if (opts.dry) {
    return { sent: 0, candidates: targets.length, events: upcoming.length, posts: recentPosts.length };
  }
  if (targets.length === 0) return { sent: 0, candidates: 0, events: upcoming.length, posts: recentPosts.length, reason: 'no eligible recipients' };

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  let body = '';
  if (upcoming.length) {
    body += `<p style="margin:0 0 8px 0;font-weight:700;">📅 coming up</p>`;
    body += upcoming.map((e) => {
      const going = yesBy.get(e.id);
      return `<p style="margin:0 0 10px 0;">• <strong>${esc(e.title)}</strong> — ${fmtWhen(e.happens_at!)}${e.area ? ` · ${esc(e.area)}` : ''}${going ? ` · ${going} going` : ''}</p>`;
    }).join('');
  }
  if (recentPosts.length) {
    body += `<p style="margin:16px 0 8px 0;font-weight:700;">💬 fresh on the board</p>`;
    body += recentPosts.map((p) => `<p style="margin:0 0 8px 0;">• ${esc(p.title)}${p.area ? ` <span style="color:#999;">(${esc(p.area)})</span>` : ''}</p>`).join('');
  }
  body += button({ href: `${base}/friends`, label: 'jump into the friend line →' });

  const html = renderEmail({
    preheader: `${upcoming.length ? `${upcoming.length} thing${upcoming.length === 1 ? '' : 's'} coming up` : 'fresh posts'} on the Friend Line.`,
    eyebrow: 'friend line · the daily',
    headline: "here's what's happening around town",
    bodyHtml: body,
  });

  const results = await Promise.allSettled(
    targets.map((u: any) => sendEmail({ to: u.email, subject: "What's happening on the Friend Line", html }))
  );
  const sentIds = targets.filter((_: any, i: number) => results[i].status === 'fulfilled').map((u: any) => u.id);
  if (sentIds.length) {
    await supabaseAdmin.from('users').update({ friend_digest_sent_at: nowIso }).in('id', sentIds);
  }

  return { sent: sentIds.length, candidates: targets.length, events: upcoming.length, posts: recentPosts.length };
}
