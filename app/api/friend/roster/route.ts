import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { assignFriendMatches, matchCapFor } from '@/lib/friend-assign';

export const dynamic = 'force-dynamic';

function metroLabel(zip: string | null | undefined): string | null {
  const m = metroOf(zip);
  return m && METRO_CENTERS[m] ? `${METRO_CENTERS[m].city}, ${METRO_CENTERS[m].state}` : null;
}

// The user's auto-assigned friend matches (up to 5). Lazily tops up on each
// fetch, so no cron needed for v1. Each row carries accept state so the UI can
// gate the chat: chat only unlocks once BOTH have accepted.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ optedIn: false, matches: [] });

  const cap = await matchCapFor(user.id);
  await assignFriendMatches(user.id, cap);

  const { data: conns } = await supabaseAdmin
    .from('friend_connections')
    .select('*')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .neq('status', 'declined')
    .order('compatibility_score', { ascending: false })
    .limit(cap);

  const otherIds = (conns ?? []).map((c) => (c.user_a_id === user.id ? c.user_b_id : c.user_a_id));
  const { data: others } = await supabaseAdmin
    .from('users')
    .select('id, name, age, photo_url, archetype, zip, friend_vibes')
    .in('id', otherIds.length ? otherIds : ['00000000-0000-0000-0000-000000000000']);
  const byId = new Map((others ?? []).map((u) => [u.id, u]));

  const myActivities: string[] = user.friend_vibes?.activities ?? [];

  const matches = (conns ?? []).map((c) => {
    const otherId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id;
    const o: any = byId.get(otherId) || {};
    const iAmA = c.user_a_id === user.id;
    const iAccepted = iAmA ? c.a_picked : c.b_picked;
    const theyAccepted = iAmA ? c.b_picked : c.a_picked;
    const shared = (o.friend_vibes?.activities ?? []).filter((a: string) => myActivities.includes(a));
    return {
      otherId,
      name: o.name, age: o.age, photo_url: o.photo_url, archetype: o.archetype,
      metro: metroLabel(o.zip),
      sharedActivities: shared,
      score: c.compatibility_score,
      iAccepted: !!iAccepted,
      theyAccepted: !!theyAccepted,
      connected: c.status === 'connected',
    };
  });

  return NextResponse.json({ optedIn: true, matches });
}
