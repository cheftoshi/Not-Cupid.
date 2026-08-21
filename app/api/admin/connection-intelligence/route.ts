import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { embeddingShadowEnabled } from '@/lib/embedding-shadow';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const requestedDays = Number(req.nextUrl.searchParams.get('days') || 30);
  const days = Number.isFinite(requestedDays) ? Math.max(1, Math.min(Math.round(requestedDays), 365)) : 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [outcomes, retention, shadow, coverage, readiness, configuration, recentEvaluations] = await Promise.all([
    supabaseAdmin.rpc('connection_outcome_summary', { p_since: since }),
    supabaseAdmin.rpc('connection_retention_cohorts', { p_days: Math.max(90, days) }),
    supabaseAdmin.rpc('embedding_shadow_summary', { p_since: since }),
    supabaseAdmin.rpc('connection_embedding_coverage'),
    supabaseAdmin.rpc('connection_intelligence_promotion_readiness'),
    supabaseAdmin.from('connection_intelligence_config')
      .select('phase, candidate_algorithm_version, measurement_started_at, minimum_shadow_evaluations, minimum_action_events, minimum_consenting_users, maximum_shadow_error_rate, maximum_p95_latency_ms, live_allocation_percent, kill_switch, human_approved_at, updated_at')
      .eq('id', 'primary')
      .maybeSingle(),
    supabaseAdmin.from('embedding_shadow_evaluations')
      .select('id, user_id, intent_scope, metro, acquisition_source, live_algorithm_version, shadow_algorithm_version, eligible_candidate_count, overlap_count, overlap_rate, rank_correlation, latency_ms, live_order_changed, error_code, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const errors = [outcomes.error, retention.error, shadow.error, coverage.error, readiness.error, configuration.error, recentEvaluations.error]
    .filter(Boolean)
    .map((error: any) => ({ code: error.code || 'unknown', message: error.message || 'unknown' }));

  const coverageRow = Array.isArray(coverage.data) ? coverage.data[0] : null;
  const readinessRow = Array.isArray(readiness.data) ? readiness.data[0] : null;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    windowDays: days,
    outcomes: outcomes.data ?? [],
    retention: retention.data ?? [],
    shadow: shadow.data ?? [],
    embeddingCoverage: {
      consentingRealUsers: coverageRow?.consenting_real_users ?? 0,
      readyRealUsers: coverageRow?.ready_real_users ?? 0,
      readyIntentEmbeddings: coverageRow?.ready_intent_embeddings ?? 0,
      failedIntentEmbeddings: coverageRow?.failed_intent_embeddings ?? 0,
    },
    operatingState: {
      shadowEnabled: embeddingShadowEnabled(),
      liveOrderingEnabled: false,
      maintenanceLimitPerRun: 25,
      scheduledBatchSize: 10,
      scheduleUtc: '35 8 * * *',
    },
    readiness: readinessRow,
    configuration: configuration.data,
    recentEvaluations: recentEvaluations.data ?? [],
    errors,
  });
}
