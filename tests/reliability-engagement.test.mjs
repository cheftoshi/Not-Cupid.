import test from 'node:test';
import assert from 'node:assert/strict';
import { requestLogin, safeLoginPath } from '../lib/login-request.ts';
import { fetchJsonWithTimeout } from '../lib/fetch-helpers.ts';
import { summarizeShadowHealth } from '../lib/shadow-health.ts';
import { summarizeFriendPlanConversations } from '../lib/friend-plan-funnel.ts';

test('login redirects stay on the app and preserve a deep link', () => {
  for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/\nevil', null, 4]) assert.equal(safeLoginPath(path), null);
  assert.equal(safeLoginPath('/match/123?hello=1'), '/match/123?hello=1');
});
test('OTP success and returning-user flags are explicit', async () => {
  assert.deepEqual(await requestLogin('send', { email: 'qa@example.com' }, { request: async () => Response.json({ success: true }) }), { ok: true });
  const result = await requestLogin('verify', { email: 'qa@example.com', code: '123456' }, { request: async (url, init) => {
    assert.equal(url, '/api/verify-otp'); assert.equal(init.credentials, 'same-origin');
    return Response.json({ redirect: '/dashboard', returning: true });
  } });
  assert.deepEqual(result, { ok: true, redirect: '/dashboard', returning: true, needsQuiz: false });
});
test('login handles malformed data, provider errors, and external redirects', async () => {
  for (const body of ['null', '{}', '<html>failure</html>', '{"redirect":"//evil.example"}']) {
    assert.equal((await requestLogin('verify', { email: 'qa@example.com' }, { request: async () => new Response(body) })).ok, false);
  }
  assert.equal((await requestLogin('send', { email: 'qa@example.com' }, { request: async () => Response.json({}) })).ok, false);
  for (const status of [400, 401, 429, 503]) {
    const result = await requestLogin('verify', { email: 'qa@example.com' }, { request: async () => Response.json({ error: 'private provider detail' }, { status }) });
    assert.equal(result.ok, false); assert.ok(!result.error.includes('private provider'));
  }
});
const abortable = signal => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }));
test('login times out both headers and response body without resending', async () => {
  for (const stalledBody of [false, true]) {
    let calls = 0;
    const result = await requestLogin('send', { email: 'qa@example.com' }, { timeoutMs: 10, request: async (_, { signal }) => {
      calls++; return stalledBody ? { ok: true, json: () => abortable(signal) } : abortable(signal);
    } });
    assert.equal(result.ok, false); assert.equal(calls, 1); assert.match(result.error, /inbox/);
  }
});
test('bounded JSON reads preserve cancellation and include the body deadline', async () => {
  await assert.rejects(fetchJsonWithTimeout('/qa', {}, 10, async (_, { signal }) => ({ json: () => abortable(signal) })));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fetchJsonWithTimeout('/qa', { signal: controller.signal }, 10, async () => { assert.fail('must not fetch'); }));
  assert.deepEqual((await fetchJsonWithTimeout('/qa', {}, 100, async () => Response.json({ roster: [] }))).data, { roster: [] });
});
test('shadow diagnostics never call an empty queue healthy', () => {
  const input = { enabled: true, readyUsers: 2, jobs: [] };
  assert.equal(summarizeShadowHealth(input).diagnosis, 'no_recent_jobs');
  assert.equal(summarizeShadowHealth(input).schedulerVerified, false);
  assert.equal(summarizeShadowHealth({ ...input, enabled: false }).diagnosis, 'runtime_disabled');
  assert.equal(summarizeShadowHealth({ ...input, readyUsers: 1 }).diagnosis, 'insufficient_embedding_coverage');
  assert.equal(summarizeShadowHealth({ ...input, available: false }).diagnosis, 'diagnostics_unavailable');
  assert.equal(summarizeShadowHealth({ ...input, readyUsers: null }).diagnosis, 'diagnostics_unavailable');
});
test('shadow jobs separate stalled processing, skips, and failures', () => {
  const job = { status: 'pending', result_code: null, available_at: '2026-09-23T00:00:00Z', created_at: '2026-09-23T00:00:00Z', finished_at: null, lease_until: null };
  const input = { enabled: true, readyUsers: 2, now: Date.parse('2026-09-23T01:00:00Z') };
  assert.equal(summarizeShadowHealth({ ...input, jobs: [job] }).diagnosis, 'queue_overdue');
  assert.equal(summarizeShadowHealth({ ...input, jobs: [{ ...job, status: 'failed' }] }).diagnosis, 'evaluation_failures');
  assert.equal(summarizeShadowHealth({ ...input, jobs: [{ ...job, status: 'skipped', result_code: 'insufficient_shadow_coverage' }] }).diagnosis, 'insufficient_reciprocal_coverage');
});
test('Friend metrics require a real organizer response after a participant, excluding tests and posts', () => {
  const plans = [
    { id: 'a', author_id: 'host', kind: 'event' }, { id: 'b', author_id: 'host', kind: 'event' },
    { id: 'c', author_id: 'host', kind: 'post' }, { id: 'd', author_id: 'test', kind: 'event', is_test: true },
  ];
  const row = (activity_id, user_id, created_at) => ({ activity_id, user_id, created_at });
  const comments = [row('a','host','01'),row('a','guest','02'),row('a','host','03'),row('b','host','01'),row('b','guest','02'),row('b','test','03'),row('c','guest','01'),row('d','guest','01')];
  assert.deepEqual(summarizeFriendPlanConversations(plans, comments, new Set(['host','guest'])), { threads: 2, participantThreads: 2, organizerReplies: 1, awaitingOrganizer: 1 });
});
