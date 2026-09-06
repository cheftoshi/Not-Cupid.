import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adaptiveReasonAdjustment, diversifyLoveRanking } from '../lib/match-diversity.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function candidate(id, eff, traits, hobbies) {
  return {
    user: { id, hobbies, ...traits },
    score: Math.round(eff),
    eff,
  };
}

test('diversity reranking is bounded, deterministic, and preserves the strongest candidate', () => {
  const similar = { score_extraversion: 8, score_openness: 8, score_conscientiousness: 6 };
  const different = { score_extraversion: 1, score_openness: 2, score_conscientiousness: 7 };
  const input = [
    candidate('top', 90, similar, ['running']),
    candidate('clone', 89, similar, ['running']),
    candidate('variety', 88, different, ['books']),
  ];
  const first = diversifyLoveRanking(input, 3);
  const second = diversifyLoveRanking(input, 3);
  assert.equal(first[0].user.id, 'top');
  assert.equal(first[1].user.id, 'variety');
  assert.deepEqual(first.map((row) => row.user.id), second.map((row) => row.user.id));
  assert.deepEqual(input.map((row) => row.user.id), ['top', 'clone', 'variety']);
});

test('adaptive learning ignores thin evidence and stays inside a two-point tie break', () => {
  assert.equal(adaptiveReasonAdjustment(['values'], [{ reasonCode: 'values', adjustment: 2, evidenceCount: 1 }]), 0);
  assert.equal(adaptiveReasonAdjustment(['values'], [{ reasonCode: 'values', adjustment: 99, evidenceCount: 3 }]), 2);
  assert.equal(adaptiveReasonAdjustment(['values'], [{ reasonCode: 'values', adjustment: -99, evidenceCount: 3 }]), -2);
});

test('live matching intelligence is feature-gated, consent-gated, and message-content blind', () => {
  const route = source('app/api/match/roster/route.ts');
  const rollout = source('lib/matching-rollouts.ts');
  const migration = source('supabase/migrations/20260906224710_reliability_realtime_and_matching_rollouts.sql');
  const privacy = source('app/privacy/page.tsx');

  assert.match(route, /features\.love_diversity\.enabled/);
  assert.match(route, /features\.love_adaptive\.enabled/);
  assert.match(route, /features\.love_embedding_cold_start\.enabled/);
  assert.match(route, /features\.cross_intent_bridge\.enabled/);
  assert.match(rollout, /stableTreatmentBucket/);
  assert.match(rollout, /connection_intelligence_promotion_readiness/);
  assert.match(rollout, /hasCrossIntentBridgeConsent/);
  assert.doesNotMatch(rollout, /from\('messages'\)|from\('friend_messages'\)|emoji|response_speed/i);
  assert.match(migration, /love_user_signal_preferences/);
  assert.match(migration, /n\.response in \('accepted', 'passed'\)/i);
  assert.match(migration, /love_embedding_cold_start', 'shadow', 0, true/i);
  assert.match(privacy, /does not analyze private chats, emojis, response speed, or infer attraction/i);
});

test('chat delivery uses a durable outbox plus privacy-safe realtime refresh events', () => {
  const migration = source('supabase/migrations/20260906224710_reliability_realtime_and_matching_rollouts.sql');
  const outbox = source('lib/notification-outbox.ts');
  const realtime = source('lib/chat-realtime.ts');
  const friend = source('app/api/friend/dm/route.ts');
  const love = source('app/api/messages/route.ts');

  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /unique \(dedupe_key\)/i);
  assert.match(outbox, /claim_notification_jobs/);
  assert.match(friend, /enqueuePushNotification/);
  assert.match(love, /enqueueLoveMessageNotification/);
  assert.match(realtime, /payload: \{ version: 1 \}/);
  assert.doesNotMatch(realtime, /message\.body|body:/);
});
