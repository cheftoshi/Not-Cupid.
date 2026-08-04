import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { assignFriendMatches, matchCapFor } from '@/lib/friend-assign';
import { evaluatePackEngagement } from '@/lib/friend-cooldown';
import { isHardLocked } from '@/lib/ghost';
import { friendLocationContext, friendMetroLabel } from '@/lib/friend-location';
import { connectionInFriendSegment } from '@/lib/friend-travel';

export const dynamic = 'force-dynamic';

function metroLabel(zip: string | null | undefined): string | null {
  const m = metroOf(zip);
  return m && METRO_CENTERS[m] ? `${METRO_CENTERS[m].city}, ${METRO_CENTERS[m].state}` : null;
}

// The user's auto-assigned friend matches. Lazily tops up on each
// fetch, so no cron needed for v1. Each row carries accept state so the UI can
// gate the chat: chat only unlocks once BOTH have accepted.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ optedIn: false, matches: [] });

  // Ghosted/paused users are locked out of matching on BOTH lines. Self-
  // reactivate (free) unless past the hard cap, where only an admin can restore.
  const cooldownActive = user.matching_cooldown_until && new Date(user.matching_cooldown_until).getTime() > Date.now();
  if (user.matching_disabled_at || cooldownActive) {
    return NextResponse.json({ optedIn: true, matches: [], ghosted: true, hardLocked: isHardLocked(user.ghost_strikes) });
  }

  const cap = await matchCapFor(user.id);
  await assignFriendMatches(user.id, cap);
  const location = await friendLocationContext(user);

  const { data: rawConns } = await supabaseAdmin
    .from('friend_connections')
    .select('*')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .neq('status', 'declined')
    .order('compatibility_score', { ascending: false });
  const conns = (rawConns || []).filter((connection: any) => {
    const iAmA = connection.user_a_id === user.id;
    const incoming = connection.status === 'pending' && (iAmA ? connection.b_picked : connection.a_picked);
    // Always surface an incoming request so temporarily changing discovery
    // metros never strands a real person who already chose this member.
    return connection.status === 'connected' || incoming || connectionInFriendSegment(connection, location.metro, location.isTraveling);
  });

  const otherIds = (conns ?? []).map((c) => (c.user_a_id === user.id ? c.user_b_id : c.user_a_id));
  const { data: others } = await supabaseAdmin
    .from('users')
    .select('id, name, age, photo_url, archetype, zip, friend_vibes, is_test')
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
      metro: c.match_metro ? friendMetroLabel(c.match_metro) : metroLabel(o.zip),
      visiting: Array.isArray(c.match_context?.travelers) && c.match_context.travelers.includes(otherId),
      sharedActivities: shared,
      score: c.compatibility_score,
      iAccepted: !!iAccepted,
      theyAccepted: !!theyAccepted,
      connected: c.status === 'connected',
      // Revealed friend (vs still sealed in a pack). Graceful pre-migration.
      opened: !('opened_at' in c) || (c as any).opened_at != null,
    };
  });

  // Realm segregation: real users never see test crew members; test accounts
  // only see other test accounts.
  const meTest = (user as any).is_test === true;
  const visible = matches.filter((m) => (((byId.get(m.otherId) as any)?.is_test === true)) === meTest);
  // How many are still SEALED in an un-opened pack (graceful pre-migration).
  const visibleIds = new Set(visible.map((m) => m.otherId));
  const sealedCount = (conns ?? []).filter((c) => {
    const otherId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id;
    return visibleIds.has(otherId) && 'opened_at' in c && (c as any).opened_at == null;
  }).length;

  // Engagement cooldown: keep ignoring your packs (no opt-in) → a 15-day break.
  const engage = await evaluatePackEngagement(user, visible);
  if (engage.cooled) return NextResponse.json({ optedIn: true, matches: [], sealedCount: 0, friendCooled: true, cooledUntil: engage.until });

  return NextResponse.json({
    optedIn: true, matches: visible, sealedCount,
    location: { metro: location.metro, label: friendMetroLabel(location.metro), isTraveling: location.isTraveling },
  });
}
