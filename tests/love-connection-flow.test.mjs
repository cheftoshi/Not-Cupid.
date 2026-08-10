import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOVE_MAX_CONNECTIONS, LOVE_ROSTER_OPTIONS } from '../lib/matching-policy.ts';

test('Love Line exposes five choices and reserves at most three pending or mutual connections', () => {
  const pick = readFileSync(new URL('../app/api/match/pick/route.ts', import.meta.url), 'utf8');
  assert.equal(LOVE_ROSTER_OPTIONS, 5);
  assert.equal(LOVE_MAX_CONNECTIONS, 3);
  assert.match(pick, /create_capacity_pending_match/);
  assert.match(pick, /p_max_connections: MAX_CONNECTIONS/);
  assert.match(pick, /await acceptMatch\(matchId, user\.id\)/);
});

test('a pick notifies the other person and mutual acceptance notifies both', () => {
  const actions = readFileSync(new URL('../lib/match-actions.ts', import.meta.url), 'utf8');
  assert.match(actions, /chose you 👀/);
  assert.match(actions, /Say yes back to make it mutual and open the chat/);
  assert.match(actions, /sendInterestNudge/);
  assert.match(actions, /sendItsAMatchEmails/);
  assert.match(actions, /idempotencyKey: `match-interest-/);
  assert.match(actions, /idempotencyKey: `mutual-match-/);
  assert.match(actions, /Promise\.all\(\[\s*sendPushToUser\(match\.user_1_id/);
  assert.match(actions, /sendPushToUser\(match\.user_2_id/);
});

test('roster rotation email retries are idempotent', () => {
  const rematch = readFileSync(new URL('../app/api/cron/rematch/route.ts', import.meta.url), 'utf8');
  assert.match(rematch, /idempotencyKey: `roster-rotation-/);
  assert.match(rematch, /value: 'roster_rotation'/);
});

test('admin engagement metrics exclude test accounts and show notification reach', () => {
  const route = readFileSync(new URL('../app/api/admin/pools/route.ts', import.meta.url), 'utf8');
  assert.match(route, /\.not\('is_test', 'is', true\)/);
  assert.match(route, /loggedIn24h/);
  assert.match(route, /loggedIn48h/);
  assert.match(route, /loggedIn12d/);
  assert.match(route, /emailReachable12d/);
  assert.match(route, /pushReachable12d/);
  assert.match(route, /rosterNotified7d/);
});
