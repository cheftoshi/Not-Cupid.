import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcileMessages } from '../lib/chat-recovery.ts';
import { connectionPriority } from '../lib/connection-priority.ts';
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('polling preserves unsent messages and reconciles lost acknowledgements by client id', () => {
  const draft = { id: 'retry-123', clientId: 'retry-123', body: 'hello', failed: true };
  assert.deepEqual(reconcileMessages([draft], []), [draft]);
  const saved = { id: 'server-123', clientId: 'retry-123', body: 'hello' };
  assert.deepEqual(reconcileMessages([draft], [saved]), [saved]);
  const unrelated = { id: 'server-other', body: 'hello' };
  assert.deepEqual(reconcileMessages([draft], [unrelated]), [unrelated, draft]);
});

test('decisions and unread chats are prioritized without mutating connection status', () => {
  const waiting = {status: 'waiting', unread: false, needsStarter: false};
  const answer = {...waiting, status: 'your-move'};
  const unread = {...waiting, status: 'chatting', unread: true};
  const starter = {...waiting, status: 'chatting', needsStarter: true};
  assert.deepEqual([waiting, starter, unread, answer].sort((a,b) => connectionPriority(a)-connectionPriority(b)), [answer, unread, starter, waiting]);
  assert.equal(waiting.status, 'waiting');
});

test('message retry reuses idempotency keys and polling reconciles instead of clearing failures', () => {
  const friend = source('app/friends/friend-hub-client.tsx');
  assert.equal((friend.match(/retry\?\.id \|\| crypto.randomUUID\(\)/g) || []).length, 2);
  assert.equal((friend.match(/reconcileMessages\(current, payload.messages/g) || []).length, 2);
  assert.match(friend, /Not confirmed · retry/);
  assert.match(friend, /clubTarget.current !== targetId/);
  assert.match(friend, /dmTarget.current !== targetId/);
  for (const route of ['app/api/friend/dm/route.ts', 'app/api/friend/clubs/[id]/messages/route.ts']) {
    assert.match(source(route), /clientId: .*sender_id === user.id/);
    assert.match(source(route), /error.code === '23505'/);
  }
});

test('refresh errors preserve the existing roster and Hub restores the request', () => {
  const roster = source('app/dashboard/roster-picker.tsx');
  assert.match(roster, /setRoster\(current => current \?\? \[\]\)/);
  assert.match(roster, /loadError && roster.length === 0/);
  const hub = source('app/hub/connection-concierge.tsx');
  assert.match(hub, /setInput\(current => current \|\| message\)/);
  assert.match(hub, /!event.nativeEvent.isComposing/);
});

test('keyboard reconciliation keeps forced updates across coalesced resize events', () => {
  const nav = source('components/top-nav.tsx');
  assert.match(nav, /forceNextFrame \|\|= forceViewport/);
  assert.match(nav, /focusout', syncKeyboard/);
  assert.match(nav, /clearTimeout\(settleTimer\)/);
  assert.match(nav, /navHeight !== lastNavHeight/);
});

test('Love sends valid first greetings without an extra gate and reuses uncertain send ids', () => {
  const chat = source('app/match/[id]/chat-room.tsx');
  assert.doesNotMatch(chat, /LOW_EFFORT|setHeyWarned|send again to send it anyway/);
  assert.match(chat, /retrySendRef.current.body === text/);
  assert.match(chat, /client_id: clientId/);
});

test('layout attribution is restricted to named regions, not private element content', () => {
  const vitals = source('components/web-vitals.tsx');
  assert.match(vitals, /closest\('\[data-perf-region\]'\)/);
  assert.doesNotMatch(vitals, /innerHTML|innerText|textContent|outerHTML/);
  assert.match(source('app/api/performance/route.ts'), /allowed.has\(region\)/);
});
