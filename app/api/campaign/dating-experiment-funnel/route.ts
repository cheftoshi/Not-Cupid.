import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  DATING_EXPERIMENT_FUNNEL_EVENTS,
  recordDatingExperimentFunnelEvent,
  type DatingExperimentFunnelEvent,
} from '@/lib/dating-experiment-funnel';

export const dynamic = 'force-dynamic';

const CLIENT_EVENTS = new Set<DatingExperimentFunnelEvent>([
  'profile_started',
  'experiment_viewed',
  'rules_continued',
  'preferences_completed',
  'schedule_selected',
  'questionnaire_completed',
  'consent_completed',
  'entry_submit_attempted',
  'entry_submit_failed',
]);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const event = String(body.event || '') as DatingExperimentFunnelEvent;
  if (!DATING_EXPERIMENT_FUNNEL_EVENTS.includes(event) || !CLIENT_EVENTS.has(event)) {
    return NextResponse.json({ error: 'Invalid funnel event' }, { status: 400 });
  }
  const suppliedMetadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
  const status = Number(suppliedMetadata.status);
  const reason = typeof suppliedMetadata.reason === 'string'
    ? suppliedMetadata.reason.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 100)
    : '';
  const metadata = event === 'entry_submit_failed'
    ? {
        ...(Number.isInteger(status) && status >= 0 && status <= 599 ? { status } : {}),
        ...(reason ? { reason } : {}),
      }
    : {};
  const recorded = await recordDatingExperimentFunnelEvent(user.id, event, metadata);
  return NextResponse.json({ ok: true, recorded });
}
