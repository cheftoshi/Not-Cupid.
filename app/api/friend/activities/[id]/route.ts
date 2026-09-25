import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { friendLocationContext } from '@/lib/friend-location';
import { planAreasForMetro } from '@/lib/neighborhoods';
import { validatePlanLocation } from '@/lib/plan-location';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const limit = await rateLimit({ key: `plan-edit:${user.id}`, windowSec: 3600, maxAttempts: 30, blockSec: 900 });
  if (!limit.ok) return NextResponse.json({ error: 'Please wait before editing again.' }, { status: 429 });
  const { data: plan } = await supabaseAdmin.from('friend_activities').select('id,author_id,metro,kind').eq('id', id).maybeSingle();
  if (!plan || plan.author_id !== user.id || plan.kind !== 'event') return NextResponse.json({ error: 'Plan unavailable.' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.action === 'cancel') {
    const { error } = await supabaseAdmin.from('friend_activities').update({ expires_at: new Date().toISOString() }).eq('id', id).eq('author_id', user.id);
    return NextResponse.json(error ? { error: 'Cancellation was not confirmed. Please retry.' } : { ok: true }, { status: error ? 503 : 200 });
  }
  const context = await friendLocationContext(user);
  let location;
  try { location = validatePlanLocation(body, planAreasForMetro(plan.metro || context.metro)); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  const { error } = await supabaseAdmin.rpc('set_connection_plan_location', { p_activity_id: id, p_user_id: user.id, p_area: location.area, p_venue: location.location, p_visibility: location.visibility });
  return NextResponse.json(error ? { error: 'Meeting place update was not confirmed. Please retry.' } : { ok: true }, { status: error ? 503 : 200 });
}

// Delete your own post/event (author only). RSVPs cascade via FK.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: act } = await supabaseAdmin
    .from('friend_activities').select('author_id').eq('id', id).maybeSingle();
  if (!act) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (act.author_id !== user.id) return NextResponse.json({ error: 'Not yours' }, { status: 403 });

  const { error } = await supabaseAdmin.from('friend_activities').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not delete activity' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
