import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { neighborhoodOf } from '@/lib/neighborhoods';

export const dynamic = 'force-dynamic';

// City Pulse: what's happening area-wise — opted-in members + live activities
// per neighborhood, plus the count of active friend groups (circles).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const nowIso = new Date().toISOString();

  // Realm segregation: a test viewer sees the test world's pulse; real users
  // see the real one (test accounts never inflate real counts).
  const realm = (q: any) => ((user as any).is_test ? q.eq('is_test', true) : q.or('is_test.is.null,is_test.eq.false'));
  // Bound the per-area aggregation scan; keep the headline total exact via a head count.
  const { data: members } = await realm(
    supabaseAdmin.from('users').select('zip').not('friend_opted_in_at', 'is', null).is('deleted_at', null)
  ).limit(5000);
  const { count: totalMembers } = await realm(
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).not('friend_opted_in_at', 'is', null).is('deleted_at', null)
  );

  const { data: acts } = await supabaseAdmin
    .from('friend_activities').select('area, kind').or(`expires_at.is.null,expires_at.gt.${nowIso}`).limit(2000);

  const { data: activeMembers } = await supabaseAdmin
    .from('friend_circle_members').select('circle_id').is('left_at', null).limit(5000);
  const activeGroups = new Set((activeMembers ?? []).map((m) => m.circle_id)).size;

  const byArea: Record<string, { area: string; members: number; activities: number }> = {};
  const bump = (area: string, key: 'members' | 'activities') => {
    if (!byArea[area]) byArea[area] = { area, members: 0, activities: 0 };
    byArea[area][key]++;
  };
  (members ?? []).forEach((m: any) => bump(neighborhoodOf(m.zip), 'members'));
  (acts ?? []).forEach((a) => bump(a.area || 'Greater Boston', 'activities'));

  const areas = Object.values(byArea).sort((a, b) => b.members - a.members || b.activities - a.activities);

  return NextResponse.json({
    totalMembers: totalMembers ?? 0,
    activeGroups,
    // "things to do" = events/hangs only (posts aren't plans).
    liveActivities: (acts ?? []).filter((a: any) => (a.kind || 'event') !== 'post').length,
    areas,
  });
}
