import 'server-only';
import {
  AI_EMBEDDING_DIMENSIONS,
  AI_EMBEDDING_MODEL,
  generateEmbedding,
  privacySafeAiUserId,
} from '@/lib/ai';
import {
  connectionEmbeddingInput,
  connectionEmbeddingInputHash,
  hasMatchingEmbeddingConsent,
  MATCHING_EMBEDDING_CONSENT_VERSION,
  MATCHING_EMBEDDING_INPUT_VERSION,
  type ConnectionIntentScope,
} from '@/lib/connection-embeddings';
import { supabaseAdmin } from '@/lib/supabase';

export const CONNECTION_EMBEDDING_USER_COLUMNS = [
  'id', 'deleted_at', 'is_blocked', 'pool_active', 'friend_opted_in_at',
  'ai_matching_consent_version', 'ai_matching_consent_at', 'ai_matching_consent_revoked_at',
  'ai_matching_embedding_checked_at',
  'score_honesty', 'score_emotionality', 'score_extraversion',
  'score_agreeableness', 'score_conscientiousness', 'score_openness',
  'values_profile', 'vibes', 'music', 'food', 'hobbies', 'sports',
  'friend_vibes',
].join(', ');

export type ConnectionEmbeddingResult = {
  intent: ConnectionIntentScope;
  status: 'created' | 'unchanged' | 'skipped' | 'failed';
  inputHash?: string;
  promptTokens?: number;
  reason?: string;
};

async function storeFailure(userId: string, intent: ConnectionIntentScope, inputHash: string, code: string) {
  const { error } = await supabaseAdmin.from('user_connection_embeddings').upsert({
    user_id: userId,
    intent_scope: intent,
    model: AI_EMBEDDING_MODEL,
    dimensions: AI_EMBEDDING_DIMENSIONS,
    input_version: MATCHING_EMBEDDING_INPUT_VERSION,
    input_hash: inputHash,
    consent_version: MATCHING_EMBEDDING_CONSENT_VERSION,
    embedding: null,
    status: 'failed',
    error_code: code.slice(0, 80),
    prompt_tokens: null,
    last_attempt_at: new Date().toISOString(),
    generated_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,intent_scope,model,dimensions,input_version' });
  if (error) console.error('[embeddings] failure state write failed:', error.message);
}

export async function generateConnectionEmbeddingForUser(
  user: any,
  intent: ConnectionIntentScope,
): Promise<ConnectionEmbeddingResult> {
  if (!user?.id || user.deleted_at || user.is_blocked === true || !hasMatchingEmbeddingConsent(user)) {
    return { intent, status: 'skipped', reason: 'not_eligible_or_consented' };
  }
  if (intent === 'love' && user.pool_active === false) {
    return { intent, status: 'skipped', reason: 'love_inactive' };
  }
  if (intent === 'friend' && !user.friend_opted_in_at) {
    return { intent, status: 'skipped', reason: 'friend_inactive' };
  }

  const input = connectionEmbeddingInput(user, intent);
  const inputHash = connectionEmbeddingInputHash(input);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('user_connection_embeddings')
    .select('input_hash, status')
    .eq('user_id', user.id)
    .eq('intent_scope', intent)
    .eq('model', AI_EMBEDDING_MODEL)
    .eq('dimensions', AI_EMBEDDING_DIMENSIONS)
    .eq('input_version', MATCHING_EMBEDDING_INPUT_VERSION)
    .maybeSingle();
  if (existingError) {
    console.error('[embeddings] existing row read failed:', existingError.message);
    return { intent, status: 'failed', inputHash, reason: 'database_read_failed' };
  }
  if (existing?.status === 'ready' && existing.input_hash === inputHash) {
    return { intent, status: 'unchanged', inputHash };
  }

  const generated = await generateEmbedding({
    input,
    model: AI_EMBEDDING_MODEL,
    dimensions: AI_EMBEDDING_DIMENSIONS,
    safetyIdentifier: privacySafeAiUserId(user.id),
  });
  if (!generated) {
    await storeFailure(user.id, intent, inputHash, 'provider_unavailable');
    return { intent, status: 'failed', inputHash, reason: 'provider_unavailable' };
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('user_connection_embeddings').upsert({
    user_id: user.id,
    intent_scope: intent,
    model: generated.model,
    dimensions: generated.dimensions,
    input_version: MATCHING_EMBEDDING_INPUT_VERSION,
    input_hash: inputHash,
    consent_version: MATCHING_EMBEDDING_CONSENT_VERSION,
    embedding: generated.embedding,
    status: 'ready',
    error_code: null,
    prompt_tokens: generated.promptTokens,
    last_attempt_at: now,
    generated_at: now,
    updated_at: now,
  }, { onConflict: 'user_id,intent_scope,model,dimensions,input_version' });
  if (error) {
    console.error('[embeddings] ready row write failed:', error.message);
    return { intent, status: 'failed', inputHash, reason: 'database_write_failed' };
  }
  return { intent, status: 'created', inputHash, promptTokens: generated.promptTokens };
}

export async function generateConnectionEmbeddingsForUser(user: any): Promise<ConnectionEmbeddingResult[]> {
  const intents: ConnectionIntentScope[] = [
    ...(user.pool_active === false ? [] : ['love' as const]),
    ...(user.friend_opted_in_at ? ['friend' as const] : []),
  ];
  const results: ConnectionEmbeddingResult[] = [];
  // Sequential requests make provider load predictable and keep a single user
  // from producing a burst when both connection lines are active.
  for (const intent of intents) results.push(await generateConnectionEmbeddingForUser(user, intent));
  return results;
}

export async function loadConnectionEmbeddingUser(userId: string): Promise<any | null> {
  const { data, error } = await supabaseAdmin.from('users')
    .select(CONNECTION_EMBEDDING_USER_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[embeddings] user read failed:', error.message);
    return null;
  }
  return data;
}

export async function deleteConnectionEmbeddings(userId: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from('user_connection_embeddings').delete().eq('user_id', userId);
  if (error) console.error('[embeddings] delete failed:', error.message);
  return !error;
}

export async function backfillConsentedConnectionEmbeddings(limit = 10): Promise<{
  users: number;
  created: number;
  unchanged: number;
  skipped: number;
  failed: number;
}> {
  const safeLimit = Math.max(1, Math.min(Math.round(limit), 25));
  const { data: users, error } = await supabaseAdmin.from('users')
    .select(CONNECTION_EMBEDDING_USER_COLUMNS)
    .eq('ai_matching_consent_version', MATCHING_EMBEDDING_CONSENT_VERSION)
    .not('ai_matching_consent_at', 'is', null)
    .is('ai_matching_consent_revoked_at', null)
    .is('deleted_at', null)
    .eq('is_blocked', false)
    .order('ai_matching_embedding_checked_at', { ascending: true, nullsFirst: true })
    .order('ai_matching_consent_at', { ascending: true })
    .limit(safeLimit);
  if (error) throw error;

  const tally = { users: users?.length ?? 0, created: 0, unchanged: 0, skipped: 0, failed: 0 };
  for (const user of (users ?? []) as any[]) {
    const results = await generateConnectionEmbeddingsForUser(user);
    for (const result of results) tally[result.status]++;
    await supabaseAdmin.from('users').update({
      ai_matching_embedding_checked_at: new Date().toISOString(),
    }).eq('id', user.id);
  }
  return tally;
}
