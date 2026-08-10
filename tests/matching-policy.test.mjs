import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_USER_DAYS,
  LOVE_MAX_CONNECTIONS,
  LOVE_ROSTER_OPTIONS,
  RECENT_USER_DAYS,
  ROSTER_EXPOSURE_COOLDOWN_DAYS,
  ROSTER_RETURN_ROTATION_HOURS,
  addedRosterCandidateIds,
  activeUserCutoffIso,
  isActiveWithinWindow,
  matchingActivitySegment,
  orderForRosterRotation,
  rosterExposureCutoffIso,
} from '../lib/matching-policy.ts';

const DAY_MS = 86_400_000;

test('matching activity and exposure cutoffs use 12 and 7 days', () => {
  const now = Date.UTC(2026, 7, 4, 12);
  assert.equal(ACTIVE_USER_DAYS, 12);
  assert.equal(RECENT_USER_DAYS, 3);
  assert.equal(ROSTER_EXPOSURE_COOLDOWN_DAYS, 7);
  assert.equal(ROSTER_RETURN_ROTATION_HOURS, 24);
  assert.equal(LOVE_MAX_CONNECTIONS, 3);
  assert.equal(LOVE_ROSTER_OPTIONS, 5);
  assert.equal(activeUserCutoffIso(now), new Date(now - 12 * DAY_MS).toISOString());
  assert.equal(rosterExposureCutoffIso(now), new Date(now - 7 * DAY_MS).toISOString());
  assert.equal(isActiveWithinWindow(new Date(now - 12 * DAY_MS).toISOString(), now), true);
  assert.equal(isActiveWithinWindow(new Date(now - 12 * DAY_MS - 1).toISOString(), now), false);
  assert.equal(matchingActivitySegment(new Date(now - 2 * DAY_MS).toISOString(), now), 'recent');
  assert.equal(matchingActivitySegment(new Date(now - 8 * DAY_MS).toISOString(), now), 'active');
  assert.equal(matchingActivitySegment(new Date(now - 13 * DAY_MS).toISOString(), now), 'dormant');
});

test('roster change detection requires a fresh candidate in an existing roster', () => {
  assert.deepEqual(addedRosterCandidateIds([], ['a', 'b']), []);
  assert.deepEqual(addedRosterCandidateIds(['a', 'b'], ['b', 'a']), []);
  assert.deepEqual(addedRosterCandidateIds(['a', 'b'], ['b', 'c']), ['c']);
  assert.deepEqual(addedRosterCandidateIds(['a', 'b'], []), []);
});

test('roster rotation prefers active unseen candidates and preserves score order inside tiers', () => {
  const ranked = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ user: { id } }));
  const ordered = orderForRosterRotation(
    ranked,
    new Map([['b', 'recent'], ['c', 'active'], ['e', 'recent']]),
    new Set(['b', 'd']),
  );
  assert.deepEqual(ordered.map((candidate) => candidate.user.id), ['e', 'c', 'b', 'a', 'd']);
});
