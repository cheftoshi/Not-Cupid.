import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { joinCircle } from '@/lib/friend-circles';
import { renderEmail, sendEmail, button, C } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Tell the OTHER person a crew just came together (the caller's already in-app).
async function emailCrewReady(otherId: string, joinerName: string) {
  const { data: u } = await supabaseAdmin
    .from('users').select('name, email, email_notifications').eq('id', otherId).single();
  if (!u?.email || u.email_notifications === false) return;
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const html = renderEmail({
    preheader: `${joinerName.split(' ')[0]} said yes — your crew chat is open.`,
    eyebrow: 'friend line · all aboard',
    headline: `${joinerName.split(' ')[0]} is in. your crew chat just opened.`,
    bodyHtml: `<p style="margin:0 0 16px 0;">you matched, you both said yes — that's a crew. the group chat's live, so go make a plan before the moment passes.</p>
      ${button({ href: `${base}/friends`, label: 'open the chat →' })}`,
  });
  await sendEmail({ to: u.email, subject: `${joinerName.split(' ')[0]} joined your crew on NotCupid`, html }).catch(() => {});
}

// "I'm in" — the user joins their matches as a SET (no per-friend curation).
// Marks the caller accepted on every non-declined connection; any pair where
// both have now joined becomes connected and shares the group circle. Per-person
// removal is the separate /api/friend/disconnect (symmetric opt-out).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join Friend Maxxin first.' }, { status: 400 });

  const { data: conns } = await supabaseAdmin
    .from('friend_connections')
    .select('*')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .neq('status', 'declined');

  let connected = 0;
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
      // Notify the other person a crew just formed.
      const otherId = iAmA ? c.user_b_id : c.user_a_id;
      await emailCrewReady(otherId, user.name || 'someone');
    } else if (!c[myField]) {
      await supabaseAdmin.from('friend_connections').update({ [myField]: true }).eq('id', c.id);
    }
  }

  return NextResponse.json({ ok: true, connected });
}
