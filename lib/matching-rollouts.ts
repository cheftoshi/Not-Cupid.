import 'server-only';
import { createHash } from 'node:crypto';
import { hasMatchingEmbeddingConsent } from '@/lib/connection-embeddings';
import { supabaseAdmin } from '@/lib/supabase';
import type { SignalPreference } from '@/lib/match-diversity';

export type MatchingFeatureKey = 'love_diversity' | 'love_adaptive' | 'love_embedding_cold_start' | 'cross_intent_bridge';
export type MatchingFeatureState = {
  key: MatchingFeatureKey;
  phase: 'shadow' | 'live_test' | 'paused';
  allocationPercent: number;
  killSwitch: boolean;
  algorithmVersion: string;
  assigned: boolean;
  enabled: boolean;
};

const DEFAULT_VERSIONS: Record<MatchingFeatureKey, string> = {
  love_diversity: 'love-diversity-v1',
  love_adaptive: 'love-adaptive-explicit-v1',
  love_embedding_cold_start: 'love-cold-start-embedding-v1',
  cross_intent_bridge: 'cross-intent-mutual-opt-in-v1',
};

export function stableTreatmentBucket(userId: string, featureKey: string): number {
  const hex = createHash('sha256').update(`${featureKey}:${userId}`).digest('hex').slice(0, 8);
  return Number.parseInt(hex, 16) % 100;
}

export async function loadMatchingFeatures(userId: string): Promise<Record<MatchingFeatureKey, MatchingFeatureState>> {
  const { data, error } = await supabaseAdmin.from('matching_feature_config')
    .select('feature_key, phase, allocation_percent, kill_switch, algorithm_version, approved_at');
  if (error) console.error('[matching-rollouts] configuration unavailable', { code: error.code });
  const rows = new Map((data ?? []).map((row: any) => [row.feature_key, row]));
  return Object.fromEntries((Object.keys(DEFAULT_VERSIONS) as MatchingFeatureKey[]).map((key) => {
    const row: any = rows.get(key);
    const phase = row?.phase === 'live_test' || row?.phase === 'paused' ? row.phase : 'shadow';
    const allocationPercent = Math.max(0, Math.min(100, Number(row?.allocation_percent ?? 0)));
    const assigned = stableTreatmentBucket(userId, key) < allocationPercent;
    return [key, {
      key,
      phase,
      allocationPercent,
      killSwitch: row?.kill_switch !== false,
      algorithmVersion: String(row?.algorithm_version || DEFAULT_VERSIONS[key]),
      assigned,
      enabled: phase === 'live_test' && row?.kill_switch === false && !!row?.approved_at && assigned,
    }];
  })) as Record<MatchingFeatureKey, MatchingFeatureState>;
}

export async function loadLoveSignalPreferences(userId: string): Promise<SignalPreference[]> {
  const { data, error } = await supabaseAdmin.rpc('love_user_signal_preferences', { p_user_id: userId });
  if (error) {
    console.error('[matching-rollouts] adaptive preferences unavailable', { code: error.code });
    return [];
  }
  return (data ?? []).map((row: any) => ({
    reasonCode: String(row.reason_code || ''),
    adjustment: Number(row.adjustment || 0),
    evidenceCount: Number(row.evidence_count || 0),
  })).filter((row: SignalPreference) => Boolean(row.reasonCode));
}

export function hasCrossIntentBridgeConsent(user: any): boolean {
  return !!user?.cross_intent_bridge_opted_in_at && !user?.cross_intent_bridge_revoked_at;
}

export async function loadConnectedFriendIds(user: any): Promise<Set<string>> {
  if (!hasCrossIntentBridgeConsent(user)) return new Set();
  const { data, error } = await supabaseAdmin.from('friend_connections')
    .select('user_a_id, user_b_id')
    .eq('status', 'connected')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
  if (error) {
    console.error('[matching-rollouts] friend bridge unavailable', { code: error.code });
    return new Set();
  }
  return new Set((data ?? []).map((row: any) => row.user_a_id === user.id ? row.user_b_id : row.user_a_id));
}

// Embeddings may influence live ordering only after all three gates pass:
// explicit user consent, the dedicated rollout, and the established global
// readiness/human-approval check.
export async function loadEmbeddingColdStartOrder(user: any, candidateIds: string[]): Promise<string[]> {
  if (!hasMatchingEmbeddingConsent(user) || candidateIds.length === 0) return [];
  const { data: readiness, error: readinessError } = await supabaseAdmin.rpc('connection_intelligence_promotion_readiness');
  const readinessRow = Array.isArray(readiness) ? readiness[0] : null;
  if (readinessError || readinessRow?.live_test_enabled !== true) return [];
  const { data, error } = await supabaseAdmin.rpc('search_connection_embeddings_shadow', {
    p_user_id: user.id,
    p_intent_scope: 'love',
    p_candidate_ids: candidateIds.slice(0, 500),
    p_match_count: Math.min(100, candidateIds.length),
  });
  if (error) {
    console.error('[matching-rollouts] embedding cold-start unavailable', { code: error.code });
    return [];
  }
  return (data ?? []).flatMap((row: any) => typeof row.user_id === 'string' ? [row.user_id] : []);
}

export function matchingTreatmentVersion(
  baseVersion: string,
  features: Record<MatchingFeatureKey, MatchingFeatureState>,
): string {
  const enabled = Object.values(features).filter((feature) => feature.enabled).map((feature) => feature.algorithmVersion).sort();
  return enabled.length ? `${baseVersion}+${enabled.join('+')}` : baseVersion;
}
