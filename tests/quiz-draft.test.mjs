import test from 'node:test';
import assert from 'node:assert/strict';
import {readQuizDraft, quizDraftKey, QUIZ_DRAFT_TTL} from '../lib/quiz-draft.ts';

test('core drafts expire, reject invalid indexes and never restore extra fields', () => {
 const now = 1000000000;
 const raw = JSON.stringify({version:1,savedAt:now,answers:[0,-1,3],otp:'123456',email:'private@example.test'});
 assert.deepEqual(readQuizDraft(raw,now),{version:1,savedAt:now,answers:[0,-1,3]});
 assert.equal(readQuizDraft(raw,now+QUIZ_DRAFT_TTL),null);
 for(const answers of [[4],[-2],[null],['0'],Array(12).fill(0)]) assert.equal(readQuizDraft(JSON.stringify({version:1,savedAt:now,answers}),now),null);
 assert.equal(readQuizDraft('{',now),null);
 assert.equal(readQuizDraft(JSON.stringify({version:1,savedAt:now+1,answers:[]}),now),null);
});
test('draft keys normalize the verified email without storing it in plaintext', async () => {
 const key=await quizDraftKey(' Person@Example.test ');
 assert.equal(key,await quizDraftKey('person@example.test'));
 assert.notEqual(key,await quizDraftKey('other@example.test'));
 assert.equal(key.includes('person'),false);
});

test('drafts preserve an in-progress selection and cursor, including the last question', () => {
 const now = 1000000000;
 for (const [answers, currentQ] of [[[], 0], [[0,1,2], 1], [Array(11).fill(-1), 11]]) {
  const draft = {version:1,savedAt:now,answers,currentQ,selectedOpt:2};
  assert.deepEqual(readQuizDraft(JSON.stringify(draft),now),draft);
 }
 for (const position of [{currentQ:1,selectedOpt:0},{currentQ:-1,selectedOpt:0},{currentQ:0,selectedOpt:4},{currentQ:0,selectedOpt:'1'},{selectedOpt:1}]) {
  assert.equal(readQuizDraft(JSON.stringify({version:1,savedAt:now,answers:[],...position}),now),null);
 }
});
