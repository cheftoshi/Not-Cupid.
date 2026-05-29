// POST /api/match/[id]/date-vibes/swipe
//
// Body: { activityId: string, decision: 'yes' | 'no' }
//
// Records this user's swipe. If the decision is 'yes' AND the partner has
// already swiped 'yes' on the same activity, returns { mutual: true } so
// the UI can pop a "you both want this!" celebration.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const activityId = typeof body?.activityId === 'string' ? body.activityId : null;
  const decision = body?.decision;
  if (!activityId || (decision !== 'yes' && decision !== 'no')) {
    return NextResponse.json({ error: 'activityId + decision required' }, { status: 400 });
  }

  // Verify membership.
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('user_1_id, user_2_id, user_1_accepted, user_2_accepted')
    .eq('id', params.id)
    .single();
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  }
  if (!match.user_1_accepted || !match.user_2_accepted) {
    return NextResponse.json({ error: 'Date vibes locked' }, { status: 400 });
  }
  const partnerId = match.user_1_id === user.id ? match.user_2_id : match.user_1_id;

  // Record/update the swipe (idempotent via upsert).
  const { error: swipeErr } = await supabaseAdmin
    .from('activity_swipes')
    .upsert(
      {
        match_id: params.id,
        user_id: user.id,
        activity_id: activityId,
        decision,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'match_id,user_id,activity_id' }
    );

  if (swipeErr) {
    console.error('swipe insert error', swipeErr);
    return NextResponse.json({ error: swipeErr.message }, { status: 500 });
  }

  // If this is a 'yes', check whether the partner also said yes → mutual.
  let mutual = false;
  if (decision === 'yes') {
    const { data: partnerSwipe } = await supabaseAdmin
      .from('activity_swipes')
      .select('decision')
      .eq('match_id', params.id)
      .eq('user_id', partnerId)
      .eq('activity_id', activityId)
      .maybeSingle();
    mutual = partnerSwipe?.decision === 'yes';
  }

  return NextResponse.json({ ok: true, mutual });
}
