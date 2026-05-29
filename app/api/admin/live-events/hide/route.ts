// POST /api/admin/live-events/hide   { activityId, reason? }
// DELETE /api/admin/live-events/hide  { activityId }   (unhide)

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const activityId = typeof body?.activityId === 'string' ? body.activityId : null;
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null;
  if (!activityId) return NextResponse.json({ error: 'activityId required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('live_activity_blacklist')
    .upsert(
      { activity_id: activityId, hidden_by: admin.id, hidden_at: new Date().toISOString(), reason },
      { onConflict: 'activity_id' }
    );

  if (error) {
    console.error('hide event error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const activityId = typeof body?.activityId === 'string' ? body.activityId : null;
  if (!activityId) return NextResponse.json({ error: 'activityId required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('live_activity_blacklist')
    .delete()
    .eq('activity_id', activityId);

  if (error) {
    console.error('unhide event error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
