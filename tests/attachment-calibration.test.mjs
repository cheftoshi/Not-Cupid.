import test from 'node:test';
import assert from 'node:assert/strict';
import { attachStyle, computeAttachment } from '../lib/quiz-data.ts';

test('neutral attachment answers are not mislabeled fearful-avoidant', () => {
  assert.deepEqual(computeAttachment(Array(8).fill(3)), {
    anxiety: 50,
    avoidance: 50,
    style: 'secure',
  });
});

test('a neutral boundary on one axis preserves the stronger attachment lean', () => {
  assert.equal(attachStyle(69, 50), 'anxious');
  assert.equal(attachStyle(50, 69), 'avoidant');
  assert.equal(attachStyle(69, 63), 'fearful');
});
