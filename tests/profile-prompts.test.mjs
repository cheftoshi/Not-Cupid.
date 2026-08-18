import test from 'node:test';
import assert from 'node:assert/strict';

const {
  PROFILE_PROMPT_OPTIONS,
  normalizeProfilePrompts,
  profilePromptDrafts,
} = await import('../lib/profile-prompts.ts');

test('profile prompt drafts retain a newly added blank answer', () => {
  const drafts = profilePromptDrafts([{ question: PROFILE_PROMPT_OPTIONS[0], answer: '' }]);
  assert.deepEqual(drafts, [{ question: PROFILE_PROMPT_OPTIONS[0], answer: '' }]);
  assert.deepEqual(normalizeProfilePrompts(drafts), []);
});

test('profile prompt drafts preserve a trailing space while the user is typing', () => {
  const value = `Coffee ${'and'} `;
  const drafts = profilePromptDrafts([{ question: PROFILE_PROMPT_OPTIONS[0], answer: value }]);
  assert.equal(drafts[0].answer, value);
  assert.equal(normalizeProfilePrompts(drafts)[0].answer, 'Coffee and');
});

test('profile prompts trim completed answers and reject unknown or duplicate prompts', () => {
  const input = [
    { question: PROFILE_PROMPT_OPTIONS[0], answer: '  Sunday coffee walks.  ' },
    { question: PROFILE_PROMPT_OPTIONS[0], answer: 'duplicate' },
    { question: 'Invented prompt', answer: 'not allowed' },
  ];
  assert.deepEqual(normalizeProfilePrompts(input), [
    { question: PROFILE_PROMPT_OPTIONS[0], answer: 'Sunday coffee walks.' },
  ]);
});

test('profile prompts enforce the three-prompt and 180-character limits', () => {
  const four = PROFILE_PROMPT_OPTIONS.slice(0, 4).map((question) => ({ question, answer: 'Answer' }));
  assert.equal(normalizeProfilePrompts(four).length, 3);
  assert.deepEqual(normalizeProfilePrompts([
    { question: PROFILE_PROMPT_OPTIONS[0], answer: 'x'.repeat(181) },
  ]), []);
});
