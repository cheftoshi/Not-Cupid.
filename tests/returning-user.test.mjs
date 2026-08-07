import test from 'node:test';
import assert from 'node:assert/strict';

const {
  RETURNING_USER_WELCOME,
  isReturningUserWelcome,
  withReturningUserWelcome,
} = await import('../lib/returning-user.ts');

test('returning-user trigger preserves internal route context', () => {
  assert.equal(
    withReturningUserWelcome('/dashboard?from=email#matches'),
    `/dashboard?from=email&welcome=${RETURNING_USER_WELCOME}#matches`,
  );
});

test('returning-user trigger fails closed for external or protocol-relative paths', () => {
  assert.equal(withReturningUserWelcome('https://example.com'), '/hub');
  assert.equal(withReturningUserWelcome('//example.com'), '/hub');
});

test('only the current upgrade key opens the returning-user experience', () => {
  assert.equal(isReturningUserWelcome(RETURNING_USER_WELCOME), true);
  assert.equal(isReturningUserWelcome('old-campaign'), false);
  assert.equal(isReturningUserWelcome(null), false);
});
