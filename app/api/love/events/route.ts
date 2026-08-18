import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { recordAppEvent } from '@/lib/app-events';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const EVENTS = new Set([
  'love_dashboard_open', 'roster_view', 'profile_open', 'pick_attempt',
  'pick_failed', 'no_suitable_choice', 'mutual_chat_open', 'coach_requested',
  'push_prompt_shown', 'push_enabled', 'push_dismissed',
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeMetadata(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 10)) {
    if (!/^[a-z][a-z0-9_]{0,31}$/i.test(key)) continue;
    if (typeof item === 'string') safe[key] = item.slice(0, 100);
    else if (typeof item === 'number' && Number.isFinite(item)) safe[key] = item;
    else if (typeof item === 'boolean' || item === null) safe[key] = item;
  }
  return safe;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const limit = await rateLimit({ key: `love-events:${user.id}`, windowSec: 60, maxAttempts: 180, blockSec: 60 });
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  if (!EVENTS.has(body.eventName)) return NextResponse.json({ ok: false }, { status: 400 });
  const path = typeof body.path === 'string' && body.path.startsWith('/') ? body.path.split('?')[0].slice(0, 200) : null;
  await recordAppEvent({
    userId: user.id,
    eventName: body.eventName,
    path,
    surface: typeof body.surface === 'string' ? body.surface : 'love',
    matchId: typeof body.matchId === 'string' && UUID_RE.test(body.matchId) ? body.matchId : null,
    candidateId: typeof body.candidateId === 'string' && UUID_RE.test(body.candidateId) ? body.candidateId : null,
    durationMs: typeof body.durationMs === 'number' ? body.durationMs : null,
    deviceClass: ['phone', 'tablet', 'desktop', 'unknown'].includes(body.deviceClass) ? body.deviceClass : 'unknown',
    displayMode: ['standalone', 'minimal-ui', 'fullscreen', 'browser', 'unknown'].includes(body.displayMode) ? body.displayMode : 'unknown',
    metadata: safeMetadata(body.metadata),
  });
  return NextResponse.json({ ok: true });
}
