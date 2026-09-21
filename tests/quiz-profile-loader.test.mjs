import test from 'node:test';
import assert from 'node:assert/strict';
import { loadQuizProfile } from '../lib/quiz-profile-loader.ts';

test('quiz profile loads valid data without caching', async () => {
  const user = { id: 'synthetic-user', name: 'QA' };
  const result = await loadQuizProfile({ request: async (url, init) => {
    assert.equal(url, '/api/profile');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.credentials, 'same-origin');
    return Response.json({ user });
  } });
  assert.deepEqual(result, { status: 'ready', user });
});

test('only 401 is treated as signed out, not a provider or server failure', async () => {
  for (const status of [401, 403, 429, 500, 502, 503]) {
    assert.deepEqual(await loadQuizProfile({ request: async () => new Response('', { status }) }),
      { status: status === 401 ? 'signed-out' : 'error' });
  }
});

test('malformed, empty and missing-user responses stay retryable', async () => {
  for (const body of ['', '<html>upstream failure</html>', 'null', '{}', '{"user":{}}', '{"user":{"id":42}}']) {
    assert.deepEqual(await loadQuizProfile({ request: async () => new Response(body) }), { status: 'error' });
  }
});

test('network rejection is handled and the next attempt can succeed', async () => {
  assert.deepEqual(await loadQuizProfile({ request: async () => { throw new TypeError('Failed to fetch'); } }), { status: 'error' });
  assert.equal((await loadQuizProfile({ request: async () => Response.json({ user: { id: 'qa' } }) })).status, 'ready');
});

function rejectOnAbort(signal) {
  return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
}

test('timeout covers both the request and reading a stalled response body', async () => {
  for (const bodyStalls of [false, true]) {
    const result = await loadQuizProfile({ timeoutMs: 10, request: async (_, { signal }) => {
      if (!bodyStalls) return rejectOnAbort(signal);
      return { status: 200, ok: true, json: () => rejectOnAbort(signal) };
    } });
    assert.deepEqual(result, { status: 'error' });
  }
});

test('navigation cancellation does not become a user-facing error', async () => {
  const controller = new AbortController();
  const result = loadQuizProfile({ signal: controller.signal, request: async (_, { signal }) => {
    const pending = rejectOnAbort(signal);
    controller.abort();
    return pending;
  } });
  assert.deepEqual(await result, { status: 'cancelled' });
  assert.deepEqual(await loadQuizProfile({ signal: controller.signal, request: () => { throw Error('Should not fetch'); } }), { status: 'cancelled' });
});
