import test from 'node:test';
import assert from 'node:assert/strict';
import { friendPlanFromDestination, friendPlanFromQuiz, friendPlanSelection, friendPlanDestination, friendPlanCoreQuiz, friendPlanSetup, friendPlanLogin, sceneLinkedActivityPath, sceneLinkedActivity } from '../lib/friend-plan-resume.ts';
import { quizPathForNewAccount } from '../lib/login-request.ts';

const id = '00000000-0000-4000-8000-000000000901';
const target = '/friends?view=scene&plan=' + id + '&from=daily-activity-drop';
const core = '/quiz?next=friends&friendPlan=' + id + '&from=daily-activity-drop';

test('Friend invite and digest selections round-trip through login, core, optional Love and Friend setup', () => {
  const selection = { id, from: 'daily-activity-drop' };
  assert.deepEqual(friendPlanFromDestination(target), selection);
  assert.equal(friendPlanDestination(selection), target);
  assert.equal(new URL(friendPlanLogin(selection), 'https://example.test').searchParams.get('next'), target);
  assert.equal(quizPathForNewAccount(target), core);
  assert.equal(quizPathForNewAccount(target, '/quiz'), core);
  assert.equal(friendPlanCoreQuiz(selection, {retake: true}), core + '&retake=1');
  assert.equal(friendPlanCoreQuiz(selection, {love: true}), core + '&line=love');
  const setup = '/friends/quiz?friendPlan=' + id + '&from=daily-activity-drop';
  assert.equal(friendPlanSetup(selection), setup);
  for (const path of [core, core + '&line=love', core + '&retake=1', setup]) {
    assert.deepEqual(friendPlanFromQuiz(new URL(path, 'https://example.test').searchParams), selection);
  }
  assert.deepEqual(friendPlanFromDestination('/friends?plan=' + id + '&view=scene'), { id });
});

test('invalid, conflicting, and non-scene selections do not carry plan intent', () => {
  for (const path of ['/friends?view=scene&plan=123', '/friends?view=crew&plan=' + id, target + '#extra',
    target + '&plan=' + id, target + '&from=other', target + '&club=123', '/other?view=scene&plan=' + id]) {
    assert.equal(friendPlanFromDestination(path), null);
  }
  assert.equal(friendPlanSelection([id, id]), null);
  assert.equal(friendPlanFromQuiz(new URLSearchParams('friendPlan=' + id + '&friendPlan=' + id)), null);
});

test('the verified returning-user welcome preserves selection without trusting arbitrary markers', () => {
  assert.deepEqual(friendPlanFromDestination(target + '&welcome=love-refresh-2026-08'),
    { id, from: 'daily-activity-drop' });
  assert.equal(friendPlanFromDestination(target + '&welcome=wrong'), null);
});

test('an untagged legacy Scene notification supports an authorized ordinary post, but digests remain event-only', () => {
  const post = { id, kind: 'post', title: 'Authorized test post' };
  assert.equal(sceneLinkedActivityPath(id, false), '/api/friend/activities?plan=' + id);
  assert.equal(sceneLinkedActivityPath(id, true), '/api/friend/activities?surface=home&plan=' + id);
  assert.equal(sceneLinkedActivity([post], id, false), post);
  assert.equal(sceneLinkedActivity([post], id, true), undefined);
  const event = { id, kind: 'event' };
  assert.equal(sceneLinkedActivity([event], id, true), event);
});

test('a failed or unrelated by-ID result never falls back to another item or unsupported kind', () => {
  assert.equal(sceneLinkedActivity([], id, false), undefined);
  assert.equal(sceneLinkedActivity([{ id: 'unrelated', kind: 'post', title: 'Never preview this' }], id, false), undefined);
  assert.equal(sceneLinkedActivity([{ id, kind: 'other' }], id, false), undefined);
});
