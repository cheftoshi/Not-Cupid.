import test from 'node:test';
import assert from 'node:assert/strict';
import { METRO_CENTERS } from '../lib/quiz-data.ts';
import {
  FRIEND_TRAVEL_PACK_SIZE,
  connectionInFriendSegment,
  travelMatchExpiry,
  travelSegmentCapacity,
  travelWindowsOverlap,
} from '../lib/friend-travel.ts';

test('travel discovery is available across every configured metro', () => {
  const metros = Object.keys(METRO_CENTERS);
  assert.ok(metros.includes('nyc'));
  assert.ok(metros.includes('boston'));
  assert.ok(metros.length >= 20);
  for (const metro of metros) {
    assert.ok(METRO_CENTERS[metro].city);
    assert.ok(METRO_CENTERS[metro].state);
  }
});

test('home and travel packs remain separate location segments', () => {
  assert.equal(connectionInFriendSegment({ match_metro: 'boston' }, 'boston', true), true);
  assert.equal(connectionInFriendSegment({ match_metro: 'nyc' }, 'boston', true), false);
  assert.equal(connectionInFriendSegment({ match_metro: null }, 'boston', true), false);
  assert.equal(connectionInFriendSegment({ match_metro: null }, 'nyc', false), true);
  assert.equal(connectionInFriendSegment({ match_metro: 'nyc' }, 'nyc', false), true);
  assert.equal(connectionInFriendSegment({ match_metro: 'boston' }, 'nyc', false), false);
});

test('a destination starts with five people and paid rounds expand it normally', () => {
  assert.equal(FRIEND_TRAVEL_PACK_SIZE, 5);
  assert.equal(travelSegmentCapacity(8, 8), 5);
  assert.equal(travelSegmentCapacity(16, 8), 13);
});

test('visitors only overlap when they are in the destination at the same time', () => {
  assert.equal(travelWindowsOverlap('2026-08-10', '2026-08-14', '2026-08-14', '2026-08-18'), true);
  assert.equal(travelWindowsOverlap('2026-08-10', '2026-08-14', '2026-08-15', '2026-08-18'), false);
});

test('an unaccepted visitor introduction ends with the shared travel window', () => {
  assert.equal(travelMatchExpiry(['2026-08-18']), '2026-08-18T23:59:59.999Z');
  assert.equal(travelMatchExpiry(['2026-08-18', '2026-08-14']), '2026-08-14T23:59:59.999Z');
  assert.equal(travelMatchExpiry([]), null);
});
