import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { MATCHING_EMBEDDING_CONSENT_VERSION } from '@/lib/connection-embeddings';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const requestedDays = Number(req.nextUrl.searchParams.get('days') || 30);
  const days = Number.isFinite(requestedDays) ? Math.max(1, Math.min(Math.round(requestedDays), 365)) : 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [outcomes, retention, shadow, consented, embeddings, recentEvaluations] = await Promise.all([
    supabaseAdmin.rpc('connection_outcome_summary', { p_since: since }),
    supabaseAdmin.rpc('connection_retention_cohorts', { p_days: Math.max(90, days) }),
    supabaseAdmin.rpc('embedding_shadow_summary', { p_since: since }),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true })
      .eq('ai_matching_consent_version', MATCHING_EMBEDDING_CONSENT_VERSION)
      .not('ai_matching_consent_at', 'is', null)
      .is('ai_matching_consent_revoked_at', null)
      .is('deleted_at', null)
      .not('is_test', 'is', true),
    supabaseAdmin.from('user_connection_embeddings').select('user_id', { count: 'exact', head: true })
      .eq('status', 'ready'),
    supabaseAdmin.from('embedding_shadow_evaluations')
      .select('id, user_id, intent_scope, live_algorithm_version, shadow_algorithm_version, eligible_candidate_count, overlap_count, overlap_rate, rank_correlation, latency_ms, error_code, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const errors = [outcomes.error, retention.error, shadow.error, consented.error, embeddings.error, recentEvaluations.error]
    .filter(Boolean)
    .map((error: any) => ({ code: error.code || 'unknown', message: error.message || 'unknown' }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    windowDays: days,
    outcomes: outcomes.data ?? [],
    retention: retention.data ?? [],
    shadow: shadow.data ?? [],
    embeddingCoverage: {
      consentingRealUsers: consented.count ?? 0,
      readyIntentEmbeddings: embeddings.count ?? 0,
    },
    recentEvaluations: recentEvaluations.data ?? [],
    errors,
  });
}
