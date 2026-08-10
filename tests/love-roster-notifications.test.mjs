import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('maintenance cron only announces a roster after verified membership change', () => {
  const route = readFileSync(new URL('../app/api/cron/rematch/route.ts', import.meta.url), 'utf8');
  assert.match(route, /composeLoveRosterForUser/);
  assert.match(route, /if \(result\.rosterChanged\) rostersChanged\+\+/);
  assert.match(route, /changedAt <= handledAt/);
  assert.match(route, /nudgedAt >= nudgeCutoff/);
  assert.match(route, /roster_notification_attempted_at/);
  assert.match(route, /6 \* 60 \* 60 \* 1000/);
  assert.match(route, /sendEmail/);
  assert.match(route, /sendPushToUser/);
  assert.doesNotMatch(route, /roster_snapshot:\s*\[\]/);
  assert.match(route, /At least one fresh compatible person is now in your roster/);
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
