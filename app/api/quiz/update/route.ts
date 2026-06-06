import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/quiz/update
 *
 * Used by the retake flow: an already-authenticated user submits new HEXACO
 * scores (+ optional vibes), we UPDATE their existing user row, end any
 * non-terminal matches (so the next match is fresh), and re-trigger /api/match.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    score_honesty,
    score_emotionality,
    score_extraversion,
    score_agreeableness,
    score_conscientiousness,
    score_openness,
    archetype,
    vibes,
    attach_anxiety, attach_avoidance, attach_style, values_profile,
  } = body;

  const clamp100 = (v: any) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  const updates: any = {
    score_honesty,
    score_emotionality,
    score_extraversion,
    score_agreeableness,
    score_conscientiousness,
    score_openness,
    archetype,
    status: 'waiting',
    pool_active: true,
  };
  if (vibes && typeof vibes === 'object') updates.vibes = vibes;
  const v2: any = {};
  if (attach_anxiety != null) v2.attach_anxiety = clamp100(attach_anxiety);
  if (attach_avoidance != null) v2.attach_avoidance = clamp100(attach_avoidance);
  if (['secure', 'anxious', 'avoidant', 'fearful'].includes(attach_style)) v2.attach_style = attach_style;
  if (values_profile && typeof values_profile === 'object') v2.values_profile = values_profile;

  let { error: updateErr } = await supabaseAdmin
    .from('users')
    .update({ ...updates, ...v2 })
    .eq('id', user.id);

  // Graceful fallback if quiz-v2 columns aren't migrated yet.
  if (updateErr && /attach_|values_profile|column|schema cache/i.test(updateErr.message || '')) {
    console.warn('Quiz update: quiz-v2 columns missing — run 20260609 migration. Saving without them.');
    ({ error: updateErr } = await supabaseAdmin.from('users').update(updates).eq('id', user.id));
  }

  if (updateErr) {
    console.error('Quiz update error:', updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // End any non-terminal pending matches so the user is free to be re-matched.
  await supabaseAdmin
    .from('matches')
    .update({ status: 'expired', ended_at: new Date().toISOString(), ended_reason: 'user_requiz' })
    .eq('status', 'pending')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`);

  // Roster-first: no auto-match trigger here. Expiring the user's pending
  // matches above is enough — the dashboard recomputes a fresh roster on load.
  // (Removed a fire-and-forget self-call to the now auth-gated /api/match.)

  return NextResponse.json({ success: true, userId: user.id });
}
