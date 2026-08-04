import test from 'node:test';
import assert from 'node:assert/strict';
import { friendCompatibilityScore } from '../lib/friend-matching.ts';
import { rankFriendDiscovery } from '../lib/friend-discovery.ts';
import { friendActivityAffinity, friendSceneCategory, normalizeFriendActivity } from '../lib/friend-taxonomy.ts';

const personality = {
  score_openness: 7,
  score_extraversion: 6,
  score_agreeableness: 6,
  score_honesty: 7,
  score_conscientiousness: 5,
};

test('friend activity taxonomy connects quiz, Scene, and club dialects', () => {
  assert.equal(normalizeFriendActivity('workouts & run club'), 'run_fitness');
  assert.equal(normalizeFriendActivity('running'), 'run_fitness');
  assert.equal(normalizeFriendActivity('concerts'), 'music');
  assert.equal(friendSceneCategory('workouts & run club'), 'active');
  assert.equal(friendSceneCategory('book club'), 'culture');
  assert.deepEqual(
    friendActivityAffinity({ activities: ['workouts & run club', 'running', 'coffee & deep talks'] }),
    ['run_fitness', 'coffee'],
  );
});

test('a focused shared activity remains strong even when one user has broad interests', () => {
  const baseVibes = { cadence: 'weekly', group_size: 'small (3–5)', life_stage: 'new to boston', intent: 'activity partners' };
  const broad = { ...personality, friend_vibes: { ...baseVibes, activities: ['workouts & run club', 'coffee & deep talks', 'food & restaurants'] } };
  const focused = { ...personality, friend_vibes: { ...baseVibes, activities: ['workouts & run club'] } };
  const disjoint = { ...personality, friend_vibes: { ...baseVibes, activities: ['gaming & nerdy stuff'] } };
  assert.ok(friendCompatibilityScore(broad, focused) >= friendCompatibilityScore(broad, disjoint) + 25);
});

test('discovery routes exact, soon, local plans ahead of unrelated inventory', () => {
  const now = Date.UTC(2026, 7, 4, 12);
  const ranked = rankFriendDiscovery([
    { id: 'far-club', kind: 'club', activityKey: 'books', cadence: 'weekly', memberCount: 30, area: 'Cambridge' },
    { id: 'right-plan', kind: 'event', activityKey: 'run_fitness', happensAt: new Date(now + 24 * 3_600_000).toISOString(), memberCount: 3, area: 'Back Bay' },
    { id: 'signal', kind: 'intent', activityKey: 'run_fitness', memberCount: 2, area: 'Somerville', createdAt: new Date(now - 2 * 3_600_000).toISOString() },
  ], { selected: 'run_fitness', affinities: ['run_fitness'], area: 'Back Bay', now });
  assert.equal(ranked[0].id, 'right-plan');
  assert.ok(ranked[0].reasons.includes('happening soon'));
  assert.equal(ranked.at(-1).id, 'far-club');
});
