import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sameRealm } from '@/lib/realm';
import { isPro } from '@/lib/pro';
import { rateLimit } from '@/lib/rate-limit';
import { aiEnabled, claudeJSON } from '@/lib/ai';
import { recordAppEvent } from '@/lib/app-events';
import { compatibilityReadRecord } from '@/lib/love-compatibility-access';
import {
  LOVE_COMPATIBILITY_READ_VERSION,
  compatibilityReadContext,
  curatedCompatibilityRead,
  type LoveCompatibilityRead,
} from '@/lib/love-compatibility-read';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPORT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['headline', 'overview', 'strengths', 'watchouts', 'firstDateIdea'],
  properties: {
    headline: { type: 'string', description: 'Warm headline under 80 characters.' },
    overview: { type: 'string', description: 'Two grounded sentences under 260 characters.' },
    strengths: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string', description: 'One grounded potential strength under 150 characters.' } },
    watchouts: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string', description: 'One non-judgmental question or contrast under 160 characters.' } },
    firstDateIdea: { type: 'string', description: 'One low-pressure public first-date angle under 180 characters.' },
  },
} as const;

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const cleanList = (value: unknown, max: number) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim().slice(0, max)).slice(0, 2)
  : [];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!UUID_RE.test(candidateId) || candidateId === user.id) {
    return NextResponse.json({ error: 'Invalid profile.' }, { status: 400 });
  }

  const existing = await compatibilityReadRecord(user.id, candidateId).catch(() => null);
  const paid = !!existing?.connection_unlock_id;
  const included = isPro(user) || (user as any).is_test === true;
  if (!paid && !included) {
    return NextResponse.json({ error: 'Unlock this AI Compatibility Read first.', paywall: true, amountCents: 99 }, { status: 402 });
  }

  const snapshot = Array.isArray(user.roster_snapshot) ? user.roster_snapshot : [];
  let allowed = paid || snapshot.includes(candidateId);
  if (!allowed) {
    const { data: live } = await supabaseAdmin.from('matches').select('id')
      .or(`and(user_1_id.eq.${user.id},user_2_id.eq.${candidateId}),and(user_1_id.eq.${candidateId},user_2_id.eq.${user.id})`)
      .is('ended_at', null).limit(1).maybeSingle();
    allowed = !!live;
  }
  if (!allowed) return NextResponse.json({ error: 'That profile is not available in your Love Line.' }, { status: 403 });

  const { data: candidate } = await supabaseAdmin.from('users').select(
    'id, name, is_test, deleted_at, music, food, hobbies, sports, score_honesty, score_emotionality, score_extraversion, score_agreeableness, score_conscientiousness, score_openness, vibes, values_profile, attach_anxiety, attach_avoidance'
  ).eq('id', candidateId).maybeSingle();
  if (!candidate || candidate.deleted_at || !sameRealm(user, candidate)) {
    return NextResponse.json({ error: 'That profile is no longer available.' }, { status: 410 });
  }

  if (existing?.report && existing.report_version === LOVE_COMPATIBILITY_READ_VERSION) {
    await recordAppEvent({ userId: user.id, eventName: 'compatibility_read_opened', surface: 'love_roster', candidateId, metadata: { source: existing.report_source || 'curated', cached: true } });
    return NextResponse.json({ read: existing.report });
  }

  const limit = await rateLimit({ key: `love-compatibility-read:${user.id}`, windowSec: 86_400, maxAttempts: 12, blockSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: 'AI Connect Coach is taking a breather. Try again shortly.' }, { status: 429 });

  const context = compatibilityReadContext(user, candidate);
  const fallback = curatedCompatibilityRead(context);
  let report: LoveCompatibilityRead = fallback;
  if (aiEnabled()) {
    const generated = await claudeJSON<{
      headline: string; overview: string; strengths: string[]; watchouts: string[]; firstDateIdea: string;
    }>({
      model: 'claude-haiku-4-5',
      maxTokens: 650,
      schema: REPORT_SCHEMA as unknown as Record<string, unknown>,
      system: `You are NotCupid's AI Connect Coach. Turn a bounded six-signal compatibility summary into useful, humane decision support.

Rules:
- Describe possibilities, never diagnoses, certainty, attraction, safety, a reply, or relationship success.
- Never rank appearance or infer protected/sensitive traits.
- Never invent facts, reveal or estimate raw quiz answers or exact trait scores, or mention information not supplied.
- Do not shame a lower or higher band. Differences are prompts for curiosity, not defects.
- Keep the tone clear, warm, specific and lightweight—not therapy language.
- Suggest one public, low-pressure first-date angle. No manipulation or pressure.
- This is an abbreviated HEXACO-inspired screen, not the full research inventory.`,
      user: `Create a private compatibility read from this bounded context. Exact scores and raw answers are intentionally absent:\n${JSON.stringify({
        firstName: context.firstName,
        visibleMatchScore: context.score,
        aggregateReasons: context.reasons,
        sharedInterests: context.sharedInterests,
        sixSignalBands: context.aiTraits,
      })}`,
    });
    if (generated) {
      const strengths = cleanList(generated.strengths, 170);
      const watchouts = cleanList(generated.watchouts, 180);
      if (strengths.length === 2 && watchouts.length === 2) {
        report = {
          ...fallback,
          headline: clean(generated.headline, 90) || fallback.headline,
          overview: clean(generated.overview, 300) || fallback.overview,
          strengths,
          watchouts,
          firstDateIdea: clean(generated.firstDateIdea, 210) || fallback.firstDateIdea,
          source: 'ai',
        };
      }
    }
  }

  const { error: saveError } = await supabaseAdmin.from('love_compatibility_reads').upsert({
    user_id: user.id,
    candidate_id: candidateId,
    report,
    report_source: report.source,
    report_version: LOVE_COMPATIBILITY_READ_VERSION,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,candidate_id' });
  if (saveError) console.error('compatibility read: cache write failed', saveError.message);
  await recordAppEvent({ userId: user.id, eventName: 'compatibility_read_opened', surface: 'love_roster', candidateId, metadata: { source: report.source, cached: false } });
  return NextResponse.json({ read: report });
}
