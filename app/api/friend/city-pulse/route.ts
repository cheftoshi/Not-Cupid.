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

  const { data: members } = await supabaseAdmin
    .from('users').select('zip').not('friend_opted_in_at', 'is', null).is('deleted_at', null);

  const { data: acts } = await supabaseAdmin
    .from('friend_activities').select('area').or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  const { data: activeMembers } = await supabaseAdmin
    .from('friend_circle_members').select('circle_id').is('left_at', null);
  const activeGroups = new Set((activeMembers ?? []).map((m) => m.circle_id)).size;

  const byArea: Record<string, { area: string; members: number; activities: number }> = {};
  const bump = (area: string, key: 'members' | 'activities') => {
    if (!byArea[area]) byArea[area] = { area, members: 0, activities: 0 };
    byArea[area][key]++;
  };
  (members ?? []).forEach((m) => bump(neighborhoodOf(m.zip), 'members'));
  (acts ?? []).forEach((a) => bump(a.area || 'Greater Boston', 'activities'));

  const areas = Object.values(byArea).sort((a, b) => b.members - a.members || b.activities - a.activities);

  return NextResponse.json({
    totalMembers: members?.length ?? 0,
    activeGroups,
    liveActivities: acts?.length ?? 0,
    areas,
  });
}
