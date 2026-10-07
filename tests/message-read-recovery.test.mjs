import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, nextMock } from './helpers/load-ts.mjs';

async function fixture({ matchError = null, messagesError = null, rows = [] } = {}) {
  let readWrites = 0;
  const db = { from(table) {
    const query = {
      select() { return this; }, eq() { return this; }, gt() { return this; }, lt() { return this; },
      order() { return this; }, update() { readWrites++; return this; }, async is() { return {}; },
      async maybeSingle() { return { data: { user_1_id: 'a', user_2_id: 'b', status: 'both_accepted' }, error: matchError }; },
      async limit() { assert.equal(table, 'messages'); return { data: rows, error: messagesError }; },
    };
    return query;
  } };
  const route = await loadTs('app/api/messages/route.ts', {
    'next/server': { ...nextMock, after() {} },
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'a' }) },
    '@/lib/supabase': { supabaseAdmin: db }, '@/lib/match-actions': {}, '@/lib/rate-limit': {},
    '@/lib/notification-outbox': {}, '@/lib/chat-realtime': { chatRealtimeTopic: () => 'topic' },
    '@/lib/pair-safety': { pairAllowed: async () => true },
  });
  return { get: query => route.GET({ nextUrl: new URL(`https://example.invalid/api/messages?match_id=m${query || ''}`) }), writes: () => readWrites };
}

for (const field of ['matchError', 'messagesError']) {
  test(`chat returns a retryable error for ${field}, without marking read`, async () => {
    const f = await fixture({ [field]: { message: 'private DB details' } });
    const response = await f.get();
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.messages, undefined);
    assert.doesNotMatch(body.error, /private DB/);
    assert.equal(f.writes(), 0);
  });
}
test('successful chat reads return oldest-first history and mark read', async () => {
  const f = await fixture({ rows: [{ id: 'new' }, { id: 'old' }] });
  assert.deepEqual((await (await f.get()).json()).messages.map(m => m.id), ['old', 'new']);
  assert.equal(f.writes(), 1);
});
test('invalid or conflicting cursors cannot be treated as incremental reads', async () => {
  for (const query of ['&after=oops', '&before=oops', '&after=2026-10-01&before=2026-10-02']) {
    const f = await fixture();
    assert.equal((await f.get(query)).status, 400);
    assert.equal(f.writes(), 0);
  }
});
