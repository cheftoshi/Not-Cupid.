import { NextRequest, NextResponse } from 'next/server';
import { recordAppEvent } from '@/lib/app-events';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const EVENTS = new Set(['web_vital', 'client_error', 'route_transition', 'api_timing']);
const METRICS = new Set(['TTFB', 'FCP', 'LCP', 'FID', 'INP', 'CLS', 'roster_api']);

export async function POST(req: NextRequest) {
  const limit = await rateLimit({ key: `performance:${getClientIp(req)}`, windowSec: 60, maxAttempts: 240, blockSec: 60 });
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  if (!EVENTS.has(body.eventName)) return NextResponse.json({ ok: false }, { status: 400 });
  const metricName = typeof body.metricName === 'string' && METRICS.has(body.metricName) ? body.metricName : null;
  const path = typeof body.path === 'string' && body.path.startsWith('/') ? body.path.split('?')[0].slice(0, 200) : null;
  await recordAppEvent({
    eventName: body.eventName,
    path,
    surface: 'client_performance',
    metricName,
    durationMs: typeof body.durationMs === 'number' ? body.durationMs : null,
    metricValue: typeof body.metricValue === 'number' ? body.metricValue : null,
    rating: ['good', 'needs-improvement', 'poor'].includes(body.rating) ? body.rating : null,
    deviceClass: ['phone', 'tablet', 'desktop', 'unknown'].includes(body.deviceClass) ? body.deviceClass : 'unknown',
    displayMode: ['standalone', 'minimal-ui', 'fullscreen', 'browser', 'unknown'].includes(body.displayMode) ? body.displayMode : 'unknown',
    sessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
    dedupeKey: typeof body.dedupeKey === 'string' ? body.dedupeKey : null,
    metadata: { release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'local' },
  });
  return NextResponse.json({ ok: true });
}
