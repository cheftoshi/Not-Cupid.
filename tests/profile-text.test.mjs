import test from 'node:test';
import assert from 'node:assert/strict';

const { normalizeProfileText } = await import('../lib/profile-text.ts');

test('optional profile text accepts legacy nulls and blank fields', () => {
  assert.deepEqual(normalizeProfileText(null, 120), { ok: true, value: null });
  assert.deepEqual(normalizeProfileText(undefined, 120), { ok: true, value: null });
  assert.deepEqual(normalizeProfileText('   ', 120), { ok: true, value: null });
});

test('profile text trims legitimate values and preserves internal formatting', () => {
  assert.deepEqual(normalizeProfileText('  Product designer  ', 120), {
    ok: true,
    value: 'Product designer',
  });
  assert.deepEqual(normalizeProfileText('First line\nSecond line', 500), {
    ok: true,
    value: 'First line\nSecond line',
  });
});

test('required profile text rejects null and blank values', () => {
  assert.deepEqual(normalizeProfileText(null, 100, true), { ok: false, reason: 'required' });
  assert.deepEqual(normalizeProfileText('  ', 100, true), { ok: false, reason: 'required' });
});

test('profile text rejects non-text and over-limit values', () => {
  assert.deepEqual(normalizeProfileText({ text: 'nope' }, 120), { ok: false, reason: 'type' });
  assert.deepEqual(normalizeProfileText('x'.repeat(121), 120), { ok: false, reason: 'length' });
});
