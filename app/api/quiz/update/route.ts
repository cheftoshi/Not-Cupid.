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
    relationship_style,
  } = body;

  const VALID_RELATIONSHIP_STYLES = new Set([
    'marriage_track', 'dink', 'enm_poly', 'casual', 'open',
  ]);

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
  if (relationship_style && VALID_RELATIONSHIP_STYLES.has(relationship_style)) {
    updates.relationship_style = relationship_style;
  }

  const { error: updateErr } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', user.id);

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

  // Fire-and-forget the match call.
  fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id }),
  }).catch((e) => console.error('Re-match trigger error:', e));

  return NextResponse.json({ success: true, userId: user.id });
}
