import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Toggle RSVP ("I'm in") on an activity. Returns the new joined state + count.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const activityId = params.id;
  const { data: existing } = await supabaseAdmin
    .from('friend_activity_rsvps')
    .select('activity_id')
    .eq('activity_id', activityId)
    .eq('user_id', user.id)
    .maybeSingle();

  let joined: boolean;
  if (existing) {
    await supabaseAdmin.from('friend_activity_rsvps').delete().eq('activity_id', activityId).eq('user_id', user.id);
    joined = false;
  } else {
    await supabaseAdmin.from('friend_activity_rsvps').upsert(
      { activity_id: activityId, user_id: user.id }, { onConflict: 'activity_id,user_id' }
    );
    joined = true;
  }

  const { count } = await supabaseAdmin
    .from('friend_activity_rsvps')
    .select('user_id', { count: 'exact', head: true })
    .eq('activity_id', activityId);

  return NextResponse.json({ ok: true, joined, count: count ?? 0 });
}
