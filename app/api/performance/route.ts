import { NextRequest, NextResponse } from 'next/server';
import { recordAppEvent } from '@/lib/app-events';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const EVENTS = new Set(['web_vital', 'client_error', 'route_transition', 'api_timing']);
const METRICS = new Set(['TTFB', 'FCP', 'LCP', 'FID', 'INP', 'CLS', 'roster_api']);
const ERROR_KINDS = new Set(['runtime', 'promise', 'resource']);
const ERROR_CODES = new Set(['abort', 'chunk_load', 'hydration', 'network', 'permission', 'resize_observer', 'syntax', 'type', 'unknown']);
const ERROR_NAMES = new Set(['AbortError', 'ChunkLoadError', 'Error', 'NetworkError', 'NotAllowedError', 'SecurityError', 'SyntaxError', 'TypeError']);

function boundedInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 10_000_000 ? value : null;
}

export async function POST(req: NextRequest) {
  const limit = await rateLimit({ key: `performance:${getClientIp(req)}`, windowSec: 60, maxAttempts: 240, blockSec: 60 });
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  if (!EVENTS.has(body.eventName)) return NextResponse.json({ ok: false }, { status: 400 });
  const metricName = typeof body.metricName === 'string' && METRICS.has(body.metricName) ? body.metricName : null;
  const path = typeof body.path === 'string' && body.path.startsWith('/') ? body.path.split('?')[0].slice(0, 200) : null;
  const sessionId = typeof body.sessionId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(body.sessionId) ? body.sessionId : null;
  const dedupeKey = typeof body.dedupeKey === 'string' && /^[a-zA-Z0-9:_-]{1,180}$/.test(body.dedupeKey) ? body.dedupeKey : null;
  const metadata: Record<string, string | number | boolean | null> = {
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'local',
  };
  if (body.eventName === 'client_error') {
    metadata.errorKind = ERROR_KINDS.has(body.errorKind) ? body.errorKind : 'runtime';
    metadata.errorCode = ERROR_CODES.has(body.errorCode) ? body.errorCode : 'unknown';
    metadata.errorName = ERROR_NAMES.has(body.errorName) ? body.errorName : 'Error';
    metadata.errorSource = typeof body.errorSource === 'string' && (body.errorSource === 'unknown' || body.errorSource === 'cross-origin' || body.errorSource.startsWith('/'))
      ? body.errorSource.split('?')[0].slice(0, 160)
      : 'unknown';
    metadata.line = boundedInteger(body.line);
    metadata.column = boundedInteger(body.column);
    metadata.fingerprint = typeof body.fingerprint === 'string' && /^[a-f0-9]{8,32}$/.test(body.fingerprint) ? body.fingerprint : null;
  }
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
    sessionId,
    dedupeKey,
    metadata,
  });
  return NextResponse.json({ ok: true });
}
