import test from 'node:test';
import assert from 'node:assert/strict';
import { isArchivedChat, canRestoreChat } from '../lib/love-chat-lifecycle.ts';
import { loadTs, nextMock } from './helpers/load-ts.mjs';
const now = Date.parse('2026-09-28T12:00:00Z');
const mutual = { user_1_accepted: true, user_2_accepted: true, status: 'both_accepted', created_at: '2026-09-01T12:00:00Z' };
test('ten-day archive boundary hides without ending; a message wakes it', () => {
  assert.equal(isArchivedChat({ ...mutual, chat_last_activity_at: '2026-09-18T12:00:00Z' }, now), true);
  assert.equal(isArchivedChat({ ...mutual, chat_last_activity_at: '2026-09-18T12:00:01Z' }, now), false);
  assert.equal(isArchivedChat({ ...mutual, chat_last_activity_at: new Date(now).toISOString() }, now), false);
  assert.equal(isArchivedChat({ ...mutual, ended_at: '2026-09-20' }, now), false);
  assert.equal(isArchivedChat({ ...mutual, user_2_accepted: false }, now), false);
});
test('only automatically expired, previously mutual chats offer restoration', () => {
  const old = { ...mutual, status: 'ended', ended_at: '2026-09-20', ended_reason: 'expired' };
  assert.equal(canRestoreChat(old), true);
  for (const patch of [{ ended_reason: 'one_passed' }, { ended_reason: 'not_vibing' }, { user_2_accepted: false }, { chat_restored_at: '2026-09-22' }, { status: 'passed' }])
    assert.equal(canRestoreChat({ ...old, ...patch }), false);
});
test('restore API authenticates, passes only session identity, handles retry, limits and failure', async () => {
  let user = null, result = { data: 'restored', error: null }, calls = [];
  const { POST } = await loadTs('app/api/matches/[id]/restore/route.ts', {
    'next/server': nextMock, '@/lib/auth': { getCurrentUser: async () => user },
    '@/lib/supabase': { supabaseAdmin: { rpc: async (...args) => { calls.push(args); return result; } } },
  });
  const params = { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }) };
  assert.equal((await POST({}, params)).status, 401);
  assert.equal(calls.length, 0);
  user = { id: 'session-user' };
  assert.equal((await POST({}, params)).status, 200);
  assert.equal(calls[0][1].p_user, user.id);
  for (const outcome of ['limit', 'capacity', 'unavailable']) {
    result = { data: outcome, error: null };
    assert.equal((await POST({}, params)).status, 409);
  }
  result = { data: 'already', error: null };
  assert.equal((await POST({}, params)).status, 200);
  result = { data: null, error: { message: 'private database detail' } };
  const failed = await POST({}, params);
  assert.equal(failed.status, 503);
  assert.doesNotMatch(JSON.stringify(await failed.json()), /private database/);
});
