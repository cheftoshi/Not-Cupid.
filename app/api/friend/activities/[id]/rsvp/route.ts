import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isLgbtqIdentity } from '@/lib/friend-matching';
import { sendPushToUser } from '@/lib/push';
import { rateLimit } from '@/lib/rate-limit';
import { recordFriendAction } from '@/lib/friend-events';
import { friendActivityInCurrentMetro } from '@/lib/friend-activity-access';
import { sameRealm } from '@/lib/realm';

export const dynamic = 'force-dynamic';

const RESPONSES = ['yes', 'maybe', 'no'] as const;
type Response = (typeof RESPONSES)[number];

// RSVP to an activity. Events take a yes/maybe/no `response` and are gated to the
// event's audience (gender + age). Posts (likes) just toggle a 'yes'. Tapping
// your current response again clears it. Returns per-response counts + my state.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `friend-rsvp:${user.id}`, windowSec: 3600, maxAttempts: 60, blockSec: 900 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many RSVP changes' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });

  const { id: activityId } = await params;
  const body = await req.json().catch(() => ({} as any));
  const desired: Response = RESPONSES.includes(body?.response) ? body.response : 'yes';

  const { data: activity } = await supabaseAdmin
    .from('friend_activities')
    .select('id, kind, title, author_id, audience_gender, audience_age_min, audience_age_max, capacity, metro, is_test')
    .eq('id', activityId)
    .maybeSingle();
  if (!activity) return NextResponse.json({ error: 'That post is no longer available.' }, { status: 404 });
  if (!sameRealm(user, activity)) {
    return NextResponse.json({ error: 'That post is no longer available.' }, { status: 404 });
  }

  const { data: existing } = await supabaseAdmin
    .from('friend_activity_rsvps')
    .select('response')
    .eq('activity_id', activityId)
    .eq('user_id', user.id)
    .maybeSingle();
  const retained = existing?.response === 'yes' || existing?.response === 'maybe';
  if (!retained && !(await friendActivityInCurrentMetro(user, activity))) {
    return NextResponse.json({ error: 'That plan is outside your current Friend Line metro.' }, { status: 404 });
  }

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

  const { data: rsvpRows, error: rsvpError } = await supabaseAdmin.rpc('set_friend_activity_rsvp', {
    p_activity_id: activityId,
    p_user_id: user.id,
    p_response: desired,
  });
  if (rsvpError) {
    if ((rsvpError.message || '').includes('capacity reached')) {
      return NextResponse.json({ error: 'This plan is full.', full: true }, { status: 409 });
    }
    console.error('[friend-rsvp]', { activityId, code: rsvpError.code });
    return NextResponse.json({ error: 'Could not update that plan.' }, { status: 500 });
  }
  const rsvp = Array.isArray(rsvpRows) ? rsvpRows[0] : rsvpRows;
  const myResponse = (rsvp?.my_response || null) as Response | null;
  const responses = {
    yes: Number(rsvp?.yes_count || 0),
    maybe: Number(rsvp?.maybe_count || 0),
    no: Number(rsvp?.no_count || 0),
  };
  const count = Number(rsvp?.total_count || 0);

  // A newly interested participant starts from "read now" so the daily drop
  // never resurfaces plan-chat history from before they joined.
  if (myResponse === 'yes') {
    await supabaseAdmin.from('friend_plan_chat_reads').upsert({
      activity_id: activityId, user_id: user.id, read_at: new Date().toISOString(),
    }, { onConflict: 'activity_id,user_id' }).then(undefined, () => {});
  }

  // Ping the host when someone's coming (yes/maybe). Events only — post 'likes'
  // would flood — and never on your own RSVP or on a clear. Per-event tag
  // collapses a wave of RSVPs into one notification for the host.
  if (
    (activity.kind || 'event') === 'event' &&
    activity.author_id !== user.id &&
    (myResponse === 'yes' || myResponse === 'maybe')
  ) {
    const who = (user.name || 'Someone').split(' ')[0];
    const verb = myResponse === 'yes' ? 'is going to' : 'might come to';
    const what = activity.title ? `"${activity.title}"` : 'your event';
    await sendPushToUser(activity.author_id, {
      title: `${who} ${verb} your event 🎟️`,
      body: `${what} — ${responses.yes} going, ${responses.maybe} maybe`,
      url: `/friends?view=scene&plan=${encodeURIComponent(activityId)}`,
      tag: `rsvp-${activityId}`,
    }).catch(() => {});
  }

  if ((activity.kind || 'event') === 'event' && (myResponse === 'yes' || myResponse === 'maybe')) {
    await recordFriendAction({
      userId: user.id,
      event: 'plan_rsvp',
      subjectType: 'activity',
      subjectId: activityId,
      metadata: { response: myResponse },
    });
  }

  return NextResponse.json({ ok: true, joined: myResponse !== null, myResponse, responses, count });
}
