import 'server-only';
import { AI_EMBEDDING_DIMENSIONS, AI_EMBEDDING_MODEL } from '@/lib/ai';
import {
  EMBEDDING_SHADOW_ALGORITHM_VERSION,
  MATCHING_EMBEDDING_INPUT_VERSION,
  sharedRankCorrelation,
  topKOverlap,
  type ConnectionIntentScope,
} from '@/lib/connection-embeddings';
import { supabaseAdmin } from '@/lib/supabase';

export function embeddingShadowEnabled(): boolean {
  return process.env.EMBEDDING_SHADOW_ENABLED === 'true';
}

export type ShadowEvaluationResult = {
  status: 'disabled' | 'recorded' | 'skipped' | 'failed';
  overlapRate?: number;
  shadowCount?: number;
  reason?: string;
};

export async function evaluateEmbeddingShadow(input: {
  userId: string;
  intent: ConnectionIntentScope;
  liveAlgorithmVersion: string;
  liveTopIds: string[];
  eligibleCandidateIds: string[];
  metro?: string | null;
  acquisitionSource?: string | null;
  force?: boolean;
}): Promise<ShadowEvaluationResult> {
  if (!input.force && !embeddingShadowEnabled()) return { status: 'disabled' };
  const liveTopIds = Array.from(new Set(input.liveTopIds.filter(Boolean))).slice(0, 10);
  const eligibleCandidateIds = Array.from(new Set(input.eligibleCandidateIds.filter(Boolean))).slice(0, 500);
  if (!input.userId || liveTopIds.length === 0 || eligibleCandidateIds.length === 0) {
    return { status: 'skipped', reason: 'empty_evaluation_set' };
  }

  const startedAt = Date.now();
  const { data, error } = await supabaseAdmin.rpc('search_connection_embeddings_shadow', {
    p_user_id: input.userId,
    p_intent_scope: input.intent,
    p_candidate_ids: eligibleCandidateIds,
    p_match_count: Math.min(50, eligibleCandidateIds.length),
  });
  const latencyMs = Date.now() - startedAt;
  const shadowTopIds = (data ?? []).flatMap((row: any) => typeof row.user_id === 'string' ? [row.user_id] : []).slice(0, 10);
  const overlap = topKOverlap(liveTopIds, shadowTopIds, 10);
  const rankCorrelation = sharedRankCorrelation(liveTopIds, shadowTopIds);
  const errorCode = error ? `rpc_${error.code || 'failed'}` : shadowTopIds.length === 0 ? 'no_shadow_candidates' : null;

  const { error: writeError } = await supabaseAdmin.from('embedding_shadow_evaluations').insert({
    user_id: input.userId,
    intent_scope: input.intent,
    live_algorithm_version: input.liveAlgorithmVersion,
    shadow_algorithm_version: `${EMBEDDING_SHADOW_ALGORITHM_VERSION}:${MATCHING_EMBEDDING_INPUT_VERSION}`,
    embedding_model: AI_EMBEDDING_MODEL,
    embedding_dimensions: AI_EMBEDDING_DIMENSIONS,
    eligible_candidate_count: eligibleCandidateIds.length,
    live_top_ids: liveTopIds,
    shadow_top_ids: shadowTopIds,
    overlap_count: overlap.count,
    overlap_rate: overlap.rate,
    rank_correlation: rankCorrelation,
    latency_ms: latencyMs,
    live_order_changed: false,
    error_code: errorCode,
    metro: input.metro?.slice(0, 80) || null,
    acquisition_source: input.acquisitionSource?.slice(0, 80) || null,
  });
  if (writeError) {
    console.error('[embedding-shadow] evaluation write failed:', writeError.message);
    return { status: 'failed', reason: 'database_write_failed' };
  }
  if (error) {
    console.error('[embedding-shadow] retrieval failed:', error.message);
    return { status: 'failed', overlapRate: overlap.rate, shadowCount: shadowTopIds.length, reason: errorCode || 'rpc_failed' };
  }
  return { status: 'recorded', overlapRate: overlap.rate, shadowCount: shadowTopIds.length, reason: errorCode || undefined };
}
