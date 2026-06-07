// POST /api/profile/set-radius  { radius: number }
//
// Sets the caller's match radius to a specific value from a fixed ladder,
// including TIGHTER than the 15mi default (some people only want matches within
// 5–10mi). Counterpart/superset of expand-radius + reset-radius. Re-arms the
// thin-pool nudge and re-runs as a fresh roster.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { MAX_MATCH_RADIUS } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

// Allowed distances (mi). Capped at the global max.
const RADIUS_LADDER = [5, 10, 15, 25, 50, 75].filter((r) => r <= MAX_MATCH_RADIUS);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const radius = Number(body.radius);
  if (!RADIUS_LADDER.includes(radius)) {
    return NextResponse.json({ error: 'Invalid radius' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ match_radius: radius, status: 'waiting', pool_active: true, radius_nudge_sent_at: null })
    .eq('id', user.id);

  if (error) {
    console.error('set-radius error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Roster-first: no auto-match. The dashboard reloads and the new radius
  // simply produces a fresh roster (GET /api/match/roster).
  return NextResponse.json({ radius });
}
