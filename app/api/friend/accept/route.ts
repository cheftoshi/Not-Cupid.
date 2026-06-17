import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { joinCircle } from '@/lib/friend-circles';
import { renderEmail, sendEmail, button, C } from '@/lib/email';
import { sendPushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Ping ONE crewmate that the chat is live and someone just hopped in — push
// (separate opt-in channel, fires regardless of the email pref) + email.
async function notifyCrewMember(memberId: string, joinerName: string, crewSize: number) {
  const first = joinerName.split(' ')[0];
  // Push first — independent of email_notifications.
  await sendPushToUser(memberId, {
    title: `${first} joined your crew 🧡`,
    body: 'the chat is live — hop in and make a plan.',
    url: '/friends?view=crew',
    tag: 'crew-join',
  });

  const { data: u } = await supabaseAdmin
    .from('users').select('name, email, email_notifications, is_test').eq('id', memberId).single();
  if (!u?.email || u.email_notifications === false || u.is_test) return;
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const others = crewSize > 2 ? `you + ${crewSize - 1} others` : 'your crew';
  const html = renderEmail({
    preheader: `${first} just joined — your crew chat is active. hop in.`,
    eyebrow: 'friend line · all aboard',
    headline: `${first} is in. the crew chat is live.`,
    bodyHtml: `<p style="margin:0 0 16px 0;">${first} just said they're in, so the group thread is open for ${others}. hop in, say hi, and make a plan before the moment passes.</p>
      ${button({ href: `${base}/friends`, label: 'hop in to the chat →' })}`,
  });
  await sendEmail({ to: u.email, subject: `${first} joined your crew — chat's live on NotCupid`, html }).catch(() => {});
}

// Notify the WHOLE crew (everyone in the touched circle(s) except the person who
// just joined) that the chat is active. Deduped across circles so each member
// gets at most one ping per accept.
async function notifyCrewGroup(circleIds: Set<string>, joinerId: string, joinerName: string) {
  const notified = new Set<string>([joinerId]);
  for (const circleId of circleIds) {
    const { data: memberRows } = await supabaseAdmin
      .from('friend_circle_members').select('user_id').eq('circle_id', circleId).is('left_at', null);
    const ids = (memberRows ?? []).map((m) => m.user_id);
    for (const id of ids) {
      if (notified.has(id)) continue;
      notified.add(id);
      await notifyCrewMember(id, joinerName, ids.length);
    }
  }
}

// "I'm in" — the user joins their matches as a SET (no per-friend curation).
// Marks the caller accepted on every non-declined connection; any pair where
// both have now joined becomes connected and shares the group circle. Per-person
// removal is the separate /api/friend/disconnect (symmetric opt-out).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join the Friend Line first.' }, { status: 400 });

  const { data: conns } = await supabaseAdmin
    .from('friend_connections')
    .select('*')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .neq('status', 'declined');

  let connected = 0;
  const touchedCircles = new Set<string>();
  for (const c of conns ?? []) {
    const iAmA = c.user_a_id === user.id;
    const myField = iAmA ? 'a_picked' : 'b_picked';
    const theyPicked = iAmA ? c.b_picked : c.a_picked;

    if (theyPicked) {
      // Both joined → connect + share a circle.
      const circleId = await joinCircle(c.user_a_id, c.user_b_id);
      await supabaseAdmin.from('friend_connections')
        .update({ [myField]: true, status: 'connected', circle_id: circleId, connected_at: new Date().toISOString() })
        .eq('id', c.id);
      connected++;
      touchedCircles.add(circleId);
    } else if (!c[myField]) {
      await supabaseAdmin.from('friend_connections').update({ [myField]: true }).eq('id', c.id);
    }
  }

  // Tell the whole crew the chat just went active — "hop in to join in."
  if (touchedCircles.size) {
    await notifyCrewGroup(touchedCircles, user.id, user.name || 'someone');
  }

  return NextResponse.json({ ok: true, connected });
}
