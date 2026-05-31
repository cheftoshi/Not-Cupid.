// POST /api/report   { reportedId, matchId?, reason, detail? }
//
// Block & report. Records the report, ends the match if there is one, writes
// the pair to match_history so they're never re-matched (the "block" effect),
// and returns the reporter to the pool. Admins review reports at /admin and
// can hard-block a user (users.is_blocked) from there.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const VALID_REASONS = new Set([
  'harassment',
  'inappropriate_messages',
  'fake_profile',
  'offensive_photos',
  'made_me_uncomfortable',
  'other',
]);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reportedId = typeof body?.reportedId === 'string' ? body.reportedId : null;
  const matchId = typeof body?.matchId === 'string' ? body.matchId : null;
  const reason = typeof body?.reason === 'string' && VALID_REASONS.has(body.reason) ? body.reason : 'other';
  const detail = typeof body?.detail === 'string' ? body.detail.slice(0, 2000) : null;

  if (!reportedId || reportedId === user.id) {
    return NextResponse.json({ error: 'Invalid report target' }, { status: 400 });
  }

  // Record the report.
  const { error: repErr } = await supabaseAdmin.from('user_reports').insert({
    reporter_id: user.id,
    reported_id: reportedId,
    match_id: matchId,
    reason,
    detail,
  });
  if (repErr) {
    console.error('report insert failed', repErr);
    return NextResponse.json({ error: repErr.message }, { status: 500 });
  }

  // End the match (if one was supplied + belongs to the reporter).
  if (matchId) {
    const { data: match } = await supabaseAdmin
      .from('matches')
      .select('user_1_id, user_2_id')
      .eq('id', matchId)
      .maybeSingle();
    if (match && (match.user_1_id === user.id || match.user_2_id === user.id)) {
      await supabaseAdmin
        .from('matches')
        .update({ status: 'ended', ended_at: new Date().toISOString(), ended_reason: 'reported' })
        .eq('id', matchId);
    }
  }

  // Block effect: write the pair to match_history so the matcher never pairs
  // them again (same no-repeat path used by end/pass).
  const [a, b] = [user.id, reportedId].sort();
  await supabaseAdmin.from('match_history').upsert(
    { user_a_id: a, user_b_id: b, match_id: matchId, outcome: 'reported' },
    { onConflict: 'user_a_id,user_b_id' }
  );

  // Return the reporter to the pool (they didn't do anything wrong).
  await supabaseAdmin.from('users').update({ status: 'waiting' }).eq('id', user.id);

  return NextResponse.json({ ok: true });
}
