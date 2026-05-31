// GET /api/match/roster
//
// The curated roster: the caller's top compatible candidates to CHOOSE from
// (vs. the algo assigning one). Computed live with the same scoring as the
// auto-matcher, so it always agrees on eligibility. Returns only safe public
// fields. Empty if the user already has an open match (the dashboard shows
// the match card in that case).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { rankCandidates } from '@/lib/matching';
import { releaseTimedOutMatches } from '@/lib/match-actions';

export const dynamic = 'force-dynamic';

const ROSTER_SIZE = 5;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Free any of the caller's timed-out matches first, so a just-expired match
  // doesn't block their roster (and so they show as 'waiting' for picking).
  await releaseTimedOutMatches(user.id);

  // If the user has a LIVE match, no roster — they're committed (one at a
  // time). "Live" = both-accepted, or a pending match still within its accept
  // window. A timed-out pending match (expires_at passed) does NOT count, so
  // the roster shows again even before the cron sweeps it.
  const { data: openMatches } = await supabaseAdmin
    .from('matches')
    .select('user_1_accepted, user_2_accepted, expires_at')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .is('ended_at', null)
    .neq('status', 'expired');

  const now = Date.now();
  const hasLive = (openMatches ?? []).some((m: any) => {
    const both = m.user_1_accepted && m.user_2_accepted;
    if (both) return true;
    return !m.expires_at || new Date(m.expires_at).getTime() >= now; // still in window
  });

  if (hasLive) return NextResponse.json({ roster: [], hasOpenMatch: true });
  if (user.pool_active === false) return NextResponse.json({ roster: [], paused: true });

  const nowIso = new Date().toISOString();
  const { data: pool } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('status', 'waiting')
    .eq('pool_active', true)
    .neq('id', user.id)
    .is('matching_disabled_at', null)
    .or(`matching_cooldown_until.is.null,matching_cooldown_until.lt.${nowIso}`);

  if (!pool || pool.length === 0) return NextResponse.json({ roster: [] });

  // Wait-time decay input (same derivation as /api/match).
  const { data: lastEnded } = await supabaseAdmin
    .from('matches')
    .select('ended_at')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const waitStartMs = lastEnded?.ended_at ? new Date(lastEnded.ended_at).getTime() : new Date(user.created_at).getTime();
  const waitDays = Math.max(0, (Date.now() - waitStartMs) / 86_400_000);

  // Exclude anyone this user has already matched with before (no repeats).
  const { data: history } = await supabaseAdmin
    .from('match_history')
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
  const seen = new Set<string>();
  for (const h of history ?? []) {
    seen.add(h.user_a_id === user.id ? h.user_b_id : h.user_a_id);
  }
  const freshPool = pool.filter((p: any) => !seen.has(p.id));

  const { ranked } = rankCandidates(user, freshPool, { waitDays });
  const roster = ranked.slice(0, ROSTER_SIZE).map((c) => ({
    id: c.user.id,
    name: c.user.name,
    age: c.user.age,
    photo_url: c.user.photo_url,
    archetype: c.user.archetype,
    zip: c.user.zip,
    relationship_style: c.user.relationship_style,
    score: c.score,
  }));

  return NextResponse.json({ roster });
}
