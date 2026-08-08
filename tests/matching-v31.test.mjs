import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCHING_ALGORITHM_VERSION,
  compatibilityBreakdown,
  hasHardDealbreakerConflict,
  isGenderMatch,
  rankCandidates,
} from '../lib/matching.ts';
import { reciprocalMomentumAdjustment } from '../lib/reciprocity.ts';
import { curatedLoveCoach, loveCoachStage } from '../lib/love-coach.ts';

const base = {
  id: 'a', gender: 'f', seeking: 'm', age: 30, age_min: 25, age_max: 36,
  zip: '02108', relationship_style: 'open',
  score_honesty: 6, score_emotionality: 5, score_extraversion: 4,
  score_agreeableness: 6, score_conscientiousness: 6, score_openness: 7,
};

test('V3.1 blocks only explicit kids dealbreakers', () => {
  assert.equal(MATCHING_ALGORITHM_VERSION, 'love-v3.1');
  assert.equal(hasHardDealbreakerConflict(
    { ...base, values_profile: { kids: 'yes' } },
    { ...base, values_profile: { kids: 'no' } },
  ), true);
  assert.equal(hasHardDealbreakerConflict(
    { ...base, values_profile: { kids: 'maybe' } },
    { ...base, values_profile: { kids: 'no' } },
  ), false);
});

test('reciprocal gender preferences cover straight, same-gender, anyone, and non-binary pairings', () => {
  assert.equal(isGenderMatch({ gender: 'f', seeking: 'm' }, { gender: 'm', seeking: 'f' }), true);
  assert.equal(isGenderMatch({ gender: 'f', seeking: 'f' }, { gender: 'f', seeking: 'f' }), true);
  assert.equal(isGenderMatch({ gender: 'nb', seeking: 'b' }, { gender: 'm', seeking: 'both' }), true);
  assert.equal(isGenderMatch({ gender: 'nb', seeking: 'f' }, { gender: 'm', seeking: 'b' }), false);
});

test('rankCandidates never returns a hard-dealbreaker conflict', () => {
  const user = { ...base, values_profile: { kids: 'yes' } };
  const conflict = { ...base, id: 'b', gender: 'm', seeking: 'f', values_profile: { kids: 'no' } };
  const result = rankCandidates(user, [conflict], { waitDays: 0, nowMs: Date.now() });
  assert.deepEqual(result.ranked, []);
});

test('shared interests and deep answers raise score confidence and yield human reasons', () => {
  const a = {
    ...base,
    music: ['jazz'], hobbies: ['climbing'],
    attach_anxiety: 20, attach_avoidance: 20,
    values_profile: { kids: 'maybe', faith: 1, partner: { pace: 'steady', draws: ['humor', 'warmth'] } },
  };
  const b = {
    ...base, id: 'b', gender: 'm', seeking: 'f',
    music: ['Jazz'], hobbies: ['climbing'],
    attach_anxiety: 25, attach_avoidance: 25,
    values_profile: { kids: 'maybe', faith: 1, partner: { pace: 'steady', draws: ['humor', 'warmth'] } },
  };
  const result = compatibilityBreakdown(a, b);
  assert.ok(result.confidence > 0.6);
  assert.ok(result.reasonCodes.length >= 1);
  assert.ok(result.reasons.every((reason) => typeof reason === 'string' && reason.length > 0));
});

test('reciprocal momentum is neutral for cold start and tightly capped', () => {
  assert.equal(reciprocalMomentumAdjustment({ invitations: 0, acceptedInvitations: 0, mutualMatches: 0, repliedMatches: 0 }), 0);
  assert.ok(reciprocalMomentumAdjustment({ invitations: 20, acceptedInvitations: 20, mutualMatches: 15, repliedMatches: 15 }) <= 2);
  assert.ok(reciprocalMomentumAdjustment({ invitations: 20, acceptedInvitations: 0, mutualMatches: 0, repliedMatches: 0 }) >= -1.5);
});

test('love coach advances from opener to wait, reply, deepen, and plan using metadata only', () => {
  assert.equal(loveCoachStage('me', []), 'opener');
  assert.equal(loveCoachStage('me', [{ sender_id: 'me' }]), 'wait');
  assert.equal(loveCoachStage('me', [{ sender_id: 'them' }]), 'reply');
  assert.equal(loveCoachStage('me', [{ sender_id: 'me' }, { sender_id: 'them' }]), 'deepen');
  assert.equal(loveCoachStage('me', Array.from({ length: 6 }, (_, i) => ({ sender_id: i % 2 ? 'them' : 'me' }))), 'plan');
});

test('curated coach is a complete fallback and never urges a second message while waiting', () => {
  const waiting = curatedLoveCoach({ stage: 'wait', firstName: 'Sam', reasons: ['your core values line up'] });
  assert.deepEqual(waiting.openers, []);
  assert.match(waiting.nextMove, /room/i);
  const opener = curatedLoveCoach({ stage: 'opener', firstName: 'Sam', reasons: [], interests: ['jazz'] });
  assert.equal(opener.openers.length, 3);
  assert.match(opener.openers[0], /jazz/i);
  assert.match(opener.disclosure, /Nothing is sent automatically/i);
});
