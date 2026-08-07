import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MATCH_LINK_SECRET = 'test-only-campaign-secret-value';

const {
  LOVE_RELAUNCH_CAMPAIGN,
  loveRelaunchPath,
  loveRelaunchToken,
  verifyLoveRelaunchToken,
} = await import('../lib/love-relaunch.ts');

const USER_ID = '11111111-1111-4111-8111-111111111111';

test('Love relaunch links are campaign-bound and destination-bound', () => {
  const token = loveRelaunchToken(USER_ID, 'dashboard', Date.now() + 60_000);
  assert.equal(LOVE_RELAUNCH_CAMPAIGN, 'love_line_aug_2026');
  assert.equal(verifyLoveRelaunchToken(USER_ID, 'dashboard', token), true);
  assert.equal(verifyLoveRelaunchToken(USER_ID, 'profile', token), false);
  assert.equal(verifyLoveRelaunchToken('22222222-2222-4222-8222-222222222222', 'dashboard', token), false);
});

test('Love relaunch links reject expiry and tampering', () => {
  const expired = loveRelaunchToken(USER_ID, 'dashboard', Date.now() - 1);
  assert.equal(verifyLoveRelaunchToken(USER_ID, 'dashboard', expired), false);
  const valid = loveRelaunchToken(USER_ID, 'profile', Date.now() + 60_000);
  assert.equal(verifyLoveRelaunchToken(USER_ID, 'profile', `${valid}x`), false);
});

test('Love relaunch destinations stay internal and explicit', () => {
  assert.equal(loveRelaunchPath('dashboard'), '/dashboard?from=love-relaunch&welcome=love-refresh-2026-08');
  assert.equal(loveRelaunchPath('profile'), '/profile?from=love-relaunch&welcome=love-refresh-2026-08');
  assert.equal(loveRelaunchPath('love_setup'), '/quiz?line=love&from=love-relaunch');
});
