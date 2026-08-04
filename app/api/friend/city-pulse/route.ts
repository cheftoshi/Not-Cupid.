import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { neighborhoodOf } from '@/lib/neighborhoods';
import { metroOf } from '@/lib/quiz-data';
import { friendLocationContext, friendMetroLabel, travelerPresenceByUser } from '@/lib/friend-location';

export const dynamic = 'force-dynamic';

// City Pulse: what's happening area-wise — opted-in members + live activities
// per neighborhood, plus the count of active friend groups (circles).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const nowIso = new Date().toISOString();
  const location = await friendLocationContext(user);
  const targetMetro = location.metro;

  // Realm segregation: a test viewer sees the test world's pulse; real users
  // see the real one (test accounts never inflate real counts).
  const realm = (q: any) => ((user as any).is_test ? q.eq('is_test', true) : q.or('is_test.is.null,is_test.eq.false'));
  // Bound the per-area aggregation scan; keep the headline total exact via a head count.
  const { data: rawMembers } = await realm(
    supabaseAdmin.from('users').select('id, zip').not('friend_opted_in_at', 'is', null).is('deleted_at', null)
  ).limit(5000);
  const memberTrips = targetMetro
    ? await travelerPresenceByUser((rawMembers || []).map((member: any) => member.id), targetMetro, location.windowStart, location.windowEnd)
    : new Map();
  const members = (rawMembers || []).filter((member: any) =>
    !targetMetro || metroOf(member.zip) === targetMetro || memberTrips.has(member.id)
  );

  let actsQuery = supabaseAdmin.from('friend_activities').select('area, kind, author_id, metro, is_test')
    .eq('is_test', (user as any).is_test === true).or(`expires_at.is.null,expires_at.gt.${nowIso}`).limit(2000);
  if (targetMetro) actsQuery = actsQuery.or(`metro.eq.${targetMetro},metro.is.null`);
  const { data: rawActs } = await actsQuery;
  // Realm-filter activities by author so test events never inflate a real user's
  // zone counts (matching the realm-segregated Scene feed).
  const actAuthorIds = Array.from(new Set((rawActs ?? []).map((a: any) => a.author_id)));
  const { data: actAuthors } = actAuthorIds.length
    ? await realm(supabaseAdmin.from('users').select('id, zip').in('id', actAuthorIds))
    : { data: [] as any[] };
  const actAuthorById = new Map((actAuthors || []).map((author: any) => [author.id, author]));
  const actTrips = targetMetro
    ? await travelerPresenceByUser(actAuthorIds, targetMetro, location.windowStart, location.windowEnd)
    : new Map();
  const acts = (rawActs ?? []).filter((activity: any) => {
    const author: any = actAuthorById.get(activity.author_id);
    if (!author) return false;
    return !targetMetro || activity.metro === targetMetro || (!activity.metro && (metroOf(author.zip) === targetMetro || actTrips.has(author.id)));
  });

  const memberIds = members.map((member: any) => member.id);
  const { data: activeMembers } = memberIds.length ? await supabaseAdmin
    .from('friend_circle_members').select('circle_id').in('user_id', memberIds).is('left_at', null).limit(5000) : { data: [] as any[] };
  const activeGroups = new Set((activeMembers ?? []).map((m) => m.circle_id)).size;

  const byArea: Record<string, { area: string; members: number; activities: number }> = {};
  const bump = (area: string, key: 'members' | 'activities') => {
    if (!byArea[area]) byArea[area] = { area, members: 0, activities: 0 };
    byArea[area][key]++;
  };
  members.forEach((member: any) => bump(memberTrips.get(member.id)?.destination_area || neighborhoodOf(member.zip), 'members'));
  (acts ?? []).forEach((a) => bump(a.area || 'Greater Boston', 'activities'));

  const areas = Object.values(byArea).sort((a, b) => b.members - a.members || b.activities - a.activities);

  return NextResponse.json({
    totalMembers: members.length,
    activeGroups,
    // "things to do" = events/hangs only (posts aren't plans).
    liveActivities: (acts ?? []).filter((a: any) => (a.kind || 'event') !== 'post').length,
    areas,
    location: { metro: targetMetro, label: friendMetroLabel(targetMetro), isTraveling: location.isTraveling },
  });
}
