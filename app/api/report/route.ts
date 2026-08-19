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

  if (!reportedId || reportedId === user.id || !matchId) {
    return NextResponse.json({ error: 'Invalid report target' }, { status: 400 });
  }

  const { data: saved, error: reportError } = await supabaseAdmin.rpc('report_love_match', {
    p_reporter_id: user.id,
    p_reported_id: reportedId,
    p_match_id: matchId,
    p_reason: reason,
    p_detail: detail,
  });
  if (reportError) {
    console.error('report transaction failed', reportError);
    return NextResponse.json({ error: 'Could not save report' }, { status: 500 });
  }
  if (saved !== true) return NextResponse.json({ error: 'You can only report your own match.' }, { status: 403 });

  return NextResponse.json({ ok: true });
}
