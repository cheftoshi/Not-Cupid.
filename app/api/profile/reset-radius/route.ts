// POST /api/profile/reset-radius
//
// Snaps the caller's match radius back to the DEFAULT (15mi) — the counterpart
// to expand-radius, for someone who widened too far and wants to keep things
// local again. Re-arms the thin-pool nudge and re-runs as a fresh roster.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { DEFAULT_MATCH_RADIUS } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const current = user.match_radius ?? DEFAULT_MATCH_RADIUS;
  if (current === DEFAULT_MATCH_RADIUS) {
    return NextResponse.json({ radius: DEFAULT_MATCH_RADIUS, alreadyDefault: true });
  }

  const { error } = await supabaseAdmin
    .from('users')
    // Clear the nudge flag so a now-narrower pool can nudge again if it's thin.
    .update({ match_radius: DEFAULT_MATCH_RADIUS, status: 'waiting', pool_active: true, radius_nudge_sent_at: null })
    .eq('id', user.id);

  if (error) {
    console.error('reset-radius error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Roster-first: no auto-match. The dashboard reloads and the narrower radius
  // simply produces a fresh roster (GET /api/match/roster).
  return NextResponse.json({ radius: DEFAULT_MATCH_RADIUS });
}
