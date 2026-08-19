import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';
import { isExperimentDecisionReason } from '@/lib/dating-experiment-behavior';

export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `experiment-behavior:${user.id}`, windowSec: 3600, maxAttempts: 30, blockSec: 900 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  const body = await req.json().catch(() => ({}));
  const roundId = String(body.roundId || '');
  if (!UUID_PATTERN.test(roundId)) return NextResponse.json({ error: 'Invalid shortlist round.' }, { status: 400 });

  if (body.event === 'shortlist_viewed' || body.event === 'feedback_skipped') {
    const { error } = await supabaseAdmin.rpc('record_dating_experiment_participant_event', {
      p_round_id: roundId,
      p_user_id: user.id,
      p_event_type: body.event,
    });
    if (error) {
      console.error('[dating-experiment-behavior-event]', error);
      return NextResponse.json({ error: 'Could not record this experiment step.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.event === 'decision_feedback') {
    if (!Array.isArray(body.feedback) || body.feedback.length < 1 || body.feedback.length > 2) {
      return NextResponse.json({ error: 'Choose up to one private reason for each option.' }, { status: 400 });
    }
    const feedback = body.feedback.map((item: any) => ({
      pairId: String(item?.pairId || ''),
      reasonCode: String(item?.reasonCode || ''),
      decision: item?.decision === true,
    }));
    if (feedback.some((item: any) => !UUID_PATTERN.test(item.pairId) || !isExperimentDecisionReason(item.reasonCode, item.decision))) {
      return NextResponse.json({ error: 'One of those private reasons is invalid.' }, { status: 400 });
    }
    const { data: count, error } = await supabaseAdmin.rpc('record_dating_experiment_decision_feedback', {
      p_round_id: roundId,
      p_user_id: user.id,
      p_feedback: feedback.map(({ pairId, reasonCode }: any) => ({ pairId, reasonCode })),
    });
    if (error || count !== feedback.length) {
      console.error('[dating-experiment-decision-feedback]', error);
      return NextResponse.json({ error: 'Could not save your optional feedback.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown experiment behavior event.' }, { status: 400 });
}
