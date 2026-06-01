import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isLgbtqIdentity } from '@/lib/friend-matching';

export const dynamic = 'force-dynamic';

const RESPONSES = ['yes', 'maybe', 'no'] as const;
type Response = (typeof RESPONSES)[number];

// RSVP to an activity. Events take a yes/maybe/no `response` and are gated to the
// event's audience (gender + age). Posts (likes) just toggle a 'yes'. Tapping
// your current response again clears it. Returns per-response counts + my state.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const activityId = params.id;
  const body = await req.json().catch(() => ({} as any));
  const desired: Response = RESPONSES.includes(body?.response) ? body.response : 'yes';

  const { data: activity } = await supabaseAdmin
    .from('friend_activities')
    .select('id, kind, author_id, audience_gender, audience_age_min, audience_age_max')
    .eq('id', activityId)
    .maybeSingle();
  if (!activity) return NextResponse.json({ error: 'That post is no longer available.' }, { status: 404 });

  // Audience gate (events only; author is always allowed).
  if ((activity.kind || 'event') === 'event' && activity.author_id !== user.id) {
    const aud = activity.audience_gender as string[] | null;
    const inGender = !Array.isArray(aud) || aud.length === 0 || aud.includes(user.gender) || (aud.includes('lgbtq') && isLgbtqIdentity(user));
    const inAgeMin = activity.audience_age_min == null || (user.age != null && user.age >= activity.audience_age_min);
    const inAgeMax = activity.audience_age_max == null || (user.age != null && user.age <= activity.audience_age_max);
    if (!inGender || !inAgeMin || !inAgeMax) {
      return NextResponse.json({ error: 'This event is open to a specific group.' }, { status: 403 });
    }
  }

  const { data: existing } = await supabaseAdmin
    .from('friend_activity_rsvps')
    .select('response')
    .eq('activity_id', activityId)
    .eq('user_id', user.id)
    .maybeSingle();

  let myResponse: Response | null;
  if (existing && existing.response === desired) {
    // Same answer tapped again → clear it.
    await supabaseAdmin.from('friend_activity_rsvps').delete().eq('activity_id', activityId).eq('user_id', user.id);
    myResponse = null;
  } else {
    await supabaseAdmin.from('friend_activity_rsvps').upsert(
      { activity_id: activityId, user_id: user.id, response: desired },
      { onConflict: 'activity_id,user_id' }
    );
    myResponse = desired;
  }

  // Fresh per-response tally.
  const { data: all } = await supabaseAdmin
    .from('friend_activity_rsvps').select('response').eq('activity_id', activityId);
  const responses = { yes: 0, maybe: 0, no: 0 };
  (all ?? []).forEach((r: any) => { const k = (r.response || 'yes') as Response; if (k in responses) responses[k]++; });
  const count = (all ?? []).length;

  return NextResponse.json({ ok: true, joined: myResponse !== null, myResponse, responses, count });
}
