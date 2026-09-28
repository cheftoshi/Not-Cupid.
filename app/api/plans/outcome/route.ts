import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { accessibleDatePlan } from '@/lib/date-plan-server';
import { dateParticipant } from '@/lib/date-plan-policy';
import { friendActivityAuthorAvailable } from '@/lib/friend-activity-access';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(body.planId || '') || !['friend', 'date'].includes(body.kind)
    || typeof body.met !== 'boolean' || (body.meetAgain != null && typeof body.meetAgain !== 'boolean'))
    return NextResponse.json({ error: 'Invalid feedback.' }, { status: 400 });
  const limit = await rateLimit({ key: `plan-outcome:${user.id}`, windowSec: 3600, maxAttempts: 30, blockSec: 900 });
  if (!limit.ok) return NextResponse.json({ error: 'Please try again later.' }, { status: 429 });
  try {
    let metro: string | null = null;
    if (body.kind === 'date') {
      const plan = await accessibleDatePlan(user, body.planId);
      if (!plan || !plan.guest_id || !dateParticipant(plan, user.id) || plan.state !== 'confirmed'
        || !plan.happens_at || Date.parse(plan.happens_at) > Date.now())
        return NextResponse.json({ error: 'Feedback is available after your confirmed date starts.' }, { status: 403 });
      metro = plan.metro;
    } else {
      const plan = await supabaseAdmin.from('friend_activities').select('id,author_id,is_test,metro,happens_at,expires_at,kind').eq('id', body.planId).maybeSingle();
      if (plan.error) throw Error('read failed');
      const p = plan.data;
      if (!p || p.kind !== 'event' || (p.is_test === true) !== (user.is_test === true)
        || !p.happens_at || Date.parse(p.happens_at) > Date.now()
        || Date.parse(p.expires_at) < Date.parse(p.happens_at)
        || !await friendActivityAuthorAvailable(user, p.author_id))
        return NextResponse.json({ error: 'Plan feedback unavailable.' }, { status: 403 });
      const member = await supabaseAdmin.from('friend_activity_rsvps').select('response').eq('activity_id', p.id).eq('user_id', user.id).eq('response', 'yes').maybeSingle();
      if (member.error) throw Error('read failed');
      if (p.author_id !== user.id && !member.data) return NextResponse.json({ error: 'Join the plan first.' }, { status: 403 });
      metro = p.metro;
    }
    const { error } = await supabaseAdmin.from('plan_outcome_feedback').upsert({
      user_id: user.id, plan_id: body.planId, plan_kind: body.kind,
      met: body.met, meet_again: body.met ? body.meetAgain ?? null : null,
      metro, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,plan_id,plan_kind' });
    if (error) throw Error('save failed');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Feedback was not saved. Please retry.' }, { status: 503 });
  }
}
