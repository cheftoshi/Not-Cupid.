import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.MATCH_LINK_SECRET = 'test-only-campaign-secret-value';

const {
  LOVE_RELAUNCH_CAMPAIGN,
  LOVE_RELAUNCH_APPROVAL_VERSION,
  LOVE_RELAUNCH_SUBJECT,
  loveRelaunchPath,
  loveRelaunchToken,
  verifyLoveRelaunchToken,
} = await import('../lib/love-relaunch.ts');

const USER_ID = '11111111-1111-4111-8111-111111111111';

test('Dating Experiment comeback links are campaign-bound and destination-bound', () => {
  const token = loveRelaunchToken(USER_ID, 'dashboard', Date.now() + 60_000);
  assert.equal(LOVE_RELAUNCH_CAMPAIGN, 'dating_experiment_comeback_aug_2026');
  assert.equal(LOVE_RELAUNCH_APPROVAL_VERSION, 'dating-experiment-comeback-v3-2026-08-15');
  assert.equal(LOVE_RELAUNCH_SUBJECT, 'Boston: dinner is on us — join the Dating Experiment');
  assert.equal(verifyLoveRelaunchToken(USER_ID, 'dashboard', token), true);
  assert.equal(verifyLoveRelaunchToken(USER_ID, 'profile', token), false);
  assert.equal(verifyLoveRelaunchToken('22222222-2222-4222-8222-222222222222', 'dashboard', token), false);
});

test('Dating Experiment comeback links reject expiry and tampering', () => {
  const expired = loveRelaunchToken(USER_ID, 'dashboard', Date.now() - 1);
  assert.equal(verifyLoveRelaunchToken(USER_ID, 'dashboard', expired), false);
  const valid = loveRelaunchToken(USER_ID, 'profile', Date.now() + 60_000);
  assert.equal(verifyLoveRelaunchToken(USER_ID, 'profile', `${valid}x`), false);
});

test('Dating Experiment comeback destinations stay internal and explicit', () => {
  assert.equal(loveRelaunchPath('experiment'), '/dating-experiment?from=dating-experiment-comeback');
  assert.equal(loveRelaunchPath('dashboard'), '/dashboard?from=dating-experiment-comeback&welcome=love-refresh-2026-08');
  assert.equal(loveRelaunchPath('profile'), '/profile?from=dating-experiment-comeback&welcome=love-refresh-2026-08');
});

test('Dating Experiment email stays preview-only until approval and launch gates pass', () => {
  const route = readFileSync(new URL('../app/api/admin/send-love-relaunch/route.ts', import.meta.url), 'utf8');
  const admin = readFileSync(new URL('../app/admin/admin-client.tsx', import.meta.url), 'utf8');
  assert.match(route, /DATING_EXPERIMENT_EMAIL_APPROVAL_VERSION === LOVE_RELAUNCH_APPROVAL_VERSION/);
  assert.match(route, /!dryRun && \(!approvalConfigured \|\| !entriesOpen\)/);
  assert.match(route, /preview-only until copy and send are separately approved/);
  assert.match(route, /No purchase necessary/);
  assert.match(route, /Only people who choose each other enter the dinner selection/);
  assert.match(route, /5–15 seconds accepted/);
  assert.match(route, /variant === 'profile' \? 'get my profile ready →' : 'join the Dating Experiment →'/);
  assert.match(route, /Your next step:/);
  assert.match(route, /primaryNeedsProfile:.*loveRelaunchPath\('profile'\)/);
  assert.match(route, /if \(missingProfileItems\(user\)\.length > 0\) return 'profile'/);
  assert.match(admin, /Preview ready variant \(no send\)/);
  assert.match(admin, /Preview profile variant \(no send\)/);
  assert.match(admin, /Preview live-match variant \(no send\)/);
  assert.doesNotMatch(admin, /Send next Love wave/);
  assert.doesNotMatch(admin, /Send me Love email test/);
});
