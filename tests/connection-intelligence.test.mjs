import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  connectionEmbeddingInput,
  connectionEmbeddingInputHash,
  hasMatchingEmbeddingConsent,
  MATCHING_EMBEDDING_CONSENT_VERSION,
  sharedRankCorrelation,
  topKOverlap,
} from '../lib/connection-embeddings.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const profile = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Private Name', email: 'private@example.com', zip: '02116', age: 34,
  gender: 'f', seeking: 'b', bio: 'Never include my biography', prompts: ['Never include my prompt'],
  score_honesty: 6, score_emotionality: 4, score_extraversion: 7,
  score_agreeableness: 5, score_conscientiousness: 6, score_openness: 8,
  values_profile: { kids: 'maybe', faith: 1, politics: 2, partner: { pace: 'steady', energy: 'balanced' } },
  vibes: { chronotype: 2, date_freq: 3, social: 2, rapid: { beach: 1, coffee: 2 } },
  music: ['jazz', 'private@example.com'], food: ['sushi'], hobbies: ['hiking'], sports: ['tennis'],
  friend_vibes: { cadence: 'weekly', group_size: 'small (3–5)', activities: ['book clubs'] },
  friend_seeking: ['f'],
};

test('embedding input is deterministic, intent-specific, and excludes direct/private fields', () => {
  const love = connectionEmbeddingInput(profile, 'love');
  const loveAgain = connectionEmbeddingInput({ ...profile }, 'love');
  const friend = connectionEmbeddingInput(profile, 'friend');
  assert.equal(love, loveAgain);
  assert.notEqual(love, friend);
  for (const privateValue of [
    profile.name, profile.email, profile.zip, String(profile.age), profile.bio, profile.prompts[0],
  ]) assert.doesNotMatch(love, new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(love, /gender:|seeking:|orientation:/i);
  assert.match(love, /honesty=0\.75/);
  assert.match(friend, /preferred friend activities: book clubs/);
  assert.equal(connectionEmbeddingInputHash(love), connectionEmbeddingInputHash(loveAgain));
  assert.match(connectionEmbeddingInputHash(love), /^[a-f0-9]{64}$/);
});

test('matching embedding consent is separate, versioned, and revocable', () => {
  assert.equal(hasMatchingEmbeddingConsent({}), false);
  assert.equal(hasMatchingEmbeddingConsent({
    ai_matching_consent_version: MATCHING_EMBEDDING_CONSENT_VERSION,
    ai_matching_consent_at: new Date().toISOString(),
    ai_matching_consent_revoked_at: null,
  }), true);
  assert.equal(hasMatchingEmbeddingConsent({
    ai_matching_consent_version: MATCHING_EMBEDDING_CONSENT_VERSION,
    ai_matching_consent_at: new Date().toISOString(),
    ai_matching_consent_revoked_at: new Date().toISOString(),
  }), false);
});

test('shadow score-card helpers measure overlap and shared rank stability', () => {
  assert.deepEqual(topKOverlap(['a', 'b', 'c'], ['b', 'c', 'd'], 3), { count: 2, rate: 2 / 3 });
  assert.equal(sharedRankCorrelation(['a', 'b', 'c'], ['a', 'b', 'c']), 1);
  assert.equal(sharedRankCorrelation(['a'], ['a']), null);
});

test('migration creates a service-only outcome ledger and consent-gated vector shadow path', () => {
  const migration = read('../supabase/migrations/20260820170000_connection_intelligence_foundation.sql');
  assert.match(migration, /create extension if not exists vector with schema extensions/i);
  assert.match(migration, /create table if not exists public\.connection_outcome_events/i);
  assert.match(migration, /revoke all on table public\.connection_outcome_events from public, anon, authenticated/i);
  assert.match(migration, /create table if not exists public\.user_connection_embeddings/i);
  assert.match(migration, /embedding extensions\.vector\(384\)/i);
  assert.match(migration, /candidate\.user_id = any\(coalesce\(p_candidate_ids/i);
  assert.match(migration, /candidate_user\.ai_matching_consent_version = candidate\.consent_version/i);
  assert.match(migration, /coalesce\(candidate_user\.is_test, false\) = coalesce\(query_user\.is_test, false\)/i);
  assert.match(migration, /live_order_changed boolean not null default false check \(live_order_changed = false\)/i);
  assert.match(migration, /connection_retention_cohorts/);
  assert.match(migration, /log_connection_love_message_outcome/);
  assert.match(migration, /log_connection_date_feedback_outcome/);
  assert.match(migration, /log_connection_safety_outcome/);
});

test('OpenAI embeddings are idempotent and shadow retrieval cannot drive the live roster', () => {
  const ai = read('../lib/ai.ts');
  const server = read('../lib/connection-embeddings-server.ts');
  const roster = read('../app/api/match/roster/route.ts');
  const shadow = read('../lib/embedding-shadow.ts');
  assert.match(ai, /embeddings\.create/);
  assert.match(ai, /text-embedding-3-small/);
  assert.match(ai, /AI_EMBEDDING_DIMENSIONS = 384/);
  assert.match(server, /existing\.input_hash === inputHash/);
  assert.match(server, /status: 'unchanged'/);
  assert.match(roster, /orderedIds = rotationRanked\.slice/);
  assert.match(roster, /evaluateEmbeddingShadow/);
  assert.doesNotMatch(roster, /orderedIds\s*=\s*shadow|roster\s*=\s*shadow/i);
  assert.match(shadow, /EMBEDDING_SHADOW_ENABLED === 'true'/);
  assert.match(shadow, /live_order_changed: false/);
});

test('Hub exposes a separate informed control and revocation deletes stored embeddings', () => {
  const client = read('../app/hub/connection-concierge.tsx');
  const api = read('../app/api/concierge/route.ts');
  const privacy = read('../app/privacy/page.tsx');
  assert.match(client, /AI match evaluation/);
  assert.match(client, /cannot reorder your roster/);
  assert.match(api, /matching_personalization/);
  assert.match(api, /deleteConnectionEmbeddings/);
  assert.match(privacy, /AI match evaluation has its own optional control/);
  assert.match(privacy, /cannot change your live roster order/);
});

test('evidence gates keep the candidate ranker at zero live allocation until human review', () => {
  const migration = read('../supabase/migrations/20260821034500_connection_intelligence_evidence_gates.sql');
  const adminApi = read('../app/api/admin/connection-intelligence/route.ts');
  const adminUi = read('../app/admin/admin-client.tsx');
  const shadow = read('../lib/embedding-shadow.ts');

  assert.match(migration, /phase text not null default 'shadow'/i);
  assert.match(migration, /live_allocation_percent integer not null default 0/i);
  assert.match(migration, /live_allocation_percent between 0 and 20/i);
  assert.match(migration, /kill_switch boolean not null default true/i);
  assert.match(migration, /human_approved_at is not null/i);
  assert.match(migration, /connection_intelligence_promotion_readiness/i);
  assert.match(migration, /not_enough_shadow_evaluations/i);
  assert.match(migration, /live_order_changed/i);
  assert.match(migration, /u\.created_at >= greatest/i);
  assert.match(adminApi, /connection_intelligence_promotion_readiness/);
  assert.match(adminApi, /shadowEnabled: embeddingShadowEnabled\(\)/);
  assert.match(adminApi, /liveOrderingEnabled: false/);
  assert.match(adminUi, /LIVE ORDER UNCHANGED/);
  assert.match(adminUi, /SHADOW/);
  assert.match(shadow, /metro: input\.metro/);
  assert.match(shadow, /acquisition_source: input\.acquisitionSource/);
});
