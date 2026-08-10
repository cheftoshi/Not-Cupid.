import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('maintenance cron cannot clear rosters or announce an unverified rotation', () => {
  const route = readFileSync(new URL('../app/api/cron/rematch/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /sendEmail/);
  assert.doesNotMatch(route, /sendPushToUser/);
  assert.doesNotMatch(route, /roster_snapshot:\s*\[\]/);
  assert.doesNotMatch(route, /Your Love Line roster just rotated/);
});

test('Love roster exposes only consented availability and coarse activity labels', () => {
  const route = readFileSync(new URL('../app/api/match/roster/route.ts', import.meta.url), 'utf8');
  const picker = readFileSync(new URL('../app/dashboard/roster-picker.tsx', import.meta.url), 'utf8');
  assert.match(route, /loveAvailability/);
  assert.match(route, /activityLabel/);
  assert.doesNotMatch(route, /lastUsedAt:/);
  assert.match(picker, /actively looking/);
  assert.match(picker, /open to meeting/);
  assert.doesNotMatch(picker, /weekly reminder by email/);
});
