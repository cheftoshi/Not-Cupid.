import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  DATING_EXPERIMENT_FUNNEL_EVENTS,
  recordDatingExperimentFunnelEvent,
  type DatingExperimentFunnelEvent,
} from '@/lib/dating-experiment-funnel';

export const dynamic = 'force-dynamic';

const CLIENT_EVENTS = new Set<DatingExperimentFunnelEvent>(['profile_started', 'experiment_viewed']);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const event = String(body.event || '') as DatingExperimentFunnelEvent;
  if (!DATING_EXPERIMENT_FUNNEL_EVENTS.includes(event) || !CLIENT_EVENTS.has(event)) {
    return NextResponse.json({ error: 'Invalid funnel event' }, { status: 400 });
  }
  const recorded = await recordDatingExperimentFunnelEvent(user.id, event);
  return NextResponse.json({ ok: true, recorded });
}
