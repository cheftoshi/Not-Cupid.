import test from 'node:test';
import assert from 'node:assert/strict';
import { requireStagingTarget } from '../scripts/e2e-target.mjs';

test('authenticated QA rejects production, mismatched or ambiguous targets', () => {
  for (const base of ['https://notcupid.com', 'https://notcupid.com.', 'https://www.notcupid.com',
    'http://staging.invalid', 'https://user:pass@staging.invalid', 'https://staging.invalid/path',
    'https://staging.invalid?redirect=production']) {
    assert.throws(() => requireStagingTarget(base, base));
  }
  assert.throws(() => requireStagingTarget('https://other.invalid', 'https://staging.invalid'));
  assert.throws(() => requireStagingTarget('https://staging.invalid', undefined));
});
test('authenticated QA accepts only its approved HTTPS staging origin', () => {
  assert.equal(requireStagingTarget('https://staging.invalid', 'https://staging.invalid').origin, 'https://staging.invalid');
});
