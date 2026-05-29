// POST /api/profile/expand-radius
//
// Widens the caller's match radius by one step (15mi), capped at 75mi, then
// re-runs the matcher so a broader pool can immediately surface a match.
// The dashboard "in the queue" state calls this when someone's local pool
// is thin and they want to look farther out.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { DEFAULT_MATCH_RADIUS, RADIUS_STEP, MAX_MATCH_RADIUS } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const current = user.match_radius ?? DEFAULT_MATCH_RADIUS;
  if (current >= MAX_MATCH_RADIUS) {
    return NextResponse.json({ radius: MAX_MATCH_RADIUS, maxed: true });
  }

  const next = Math.min(MAX_MATCH_RADIUS, current + RADIUS_STEP);

  const { error } = await supabaseAdmin
    .from('users')
    // Clear the nudge flag — if the wider radius is also thin, they can be
    // nudged again after the cooldown.
    .update({ match_radius: next, status: 'waiting', pool_active: true, radius_nudge_sent_at: null })
    .eq('id', user.id);

  if (error) {
    console.error('expand-radius error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire a fresh match attempt with the wider radius (don't block the response).
  fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id }),
  }).catch((e) => console.error('expand-radius: match trigger failed', e));

  return NextResponse.json({ radius: next, maxed: next >= MAX_MATCH_RADIUS });
}
