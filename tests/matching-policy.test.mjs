import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_USER_DAYS,
  ROSTER_EXPOSURE_COOLDOWN_DAYS,
  activeUserCutoffIso,
  isActiveWithinWindow,
  orderForRosterRotation,
  rosterExposureCutoffIso,
} from '../lib/matching-policy.ts';

const DAY_MS = 86_400_000;

test('matching activity and exposure cutoffs use 12 and 7 days', () => {
  const now = Date.UTC(2026, 7, 4, 12);
  assert.equal(ACTIVE_USER_DAYS, 12);
  assert.equal(ROSTER_EXPOSURE_COOLDOWN_DAYS, 7);
  assert.equal(activeUserCutoffIso(now), new Date(now - 12 * DAY_MS).toISOString());
  assert.equal(rosterExposureCutoffIso(now), new Date(now - 7 * DAY_MS).toISOString());
  assert.equal(isActiveWithinWindow(new Date(now - 12 * DAY_MS).toISOString(), now), true);
  assert.equal(isActiveWithinWindow(new Date(now - 12 * DAY_MS - 1).toISOString(), now), false);
});

test('roster rotation prefers active unseen candidates and preserves score order inside tiers', () => {
  const ranked = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ user: { id } }));
  const ordered = orderForRosterRotation(
    ranked,
    new Set(['b', 'c', 'e']),
    new Set(['b', 'd']),
  );
  assert.deepEqual(ordered.map((candidate) => candidate.user.id), ['c', 'e', 'b', 'a', 'd']);
});
