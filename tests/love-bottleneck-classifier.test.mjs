import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeLoveBottlenecks } from '../lib/love-bottleneck-classifier.ts';

test('uncovered Love users are placed in one actionable reason bucket', () => {
  const result = summarizeLoveBottlenecks({
    users: [
      { id: 'live', gender: 'm', seeking: 'f', age: 31, metro: 'boston', rosterSnapshot: ['a'] },
      { id: 'inventory', gender: 'f', seeking: 'm', age: 28, metro: 'boston', rosterSnapshot: ['b', 'c'] },
      { id: 'picker', gender: 'm', seeking: 'b', age: 42, metro: 'nyc', rosterSnapshot: ['d'] },
      { id: 'empty', gender: 'f', seeking: 'm', age: 35, metro: 'boston', rosterSnapshot: [] },
    ],
    liveParticipantIds: new Set(['live']),
    shown24hIds: new Set(['inventory']),
    picked7dIds: new Set(['picker']),
  });

  assert.equal(result.total, 3);
  assert.deepEqual(result.reasons, {
    noRosterInventory: 1,
    rosterAvailableNoPick7d: 1,
    pickedButNoLiveConnection7d: 1,
  });
  assert.equal(Object.values(result.reasons).reduce((sum, count) => sum + count, 0), result.total);
  assert.deepEqual(result.gender, { women: 2, men: 1 });
  assert.deepEqual(result.seeking, { men: 2, everyone: 1 });
  assert.deepEqual(result.metro, { boston: 2, nyc: 1 });
  assert.deepEqual(result.rosterSizes, { '1–4': 2, '0': 1 });
});

test('a recent pick takes priority over an empty refreshed roster', () => {
  const result = summarizeLoveBottlenecks({
    users: [{ id: 'returned', rosterSnapshot: [] }],
    liveParticipantIds: new Set(),
    shown24hIds: new Set(),
    picked7dIds: new Set(['returned']),
  });
  assert.equal(result.reasons.pickedButNoLiveConnection7d, 1);
  assert.equal(result.reasons.noRosterInventory, 0);
});
