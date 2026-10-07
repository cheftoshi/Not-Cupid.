import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, nextMock } from './helpers/load-ts.mjs';

for (const fails of [true, false]) {
  test(`Friend pass ${fails ? 'does not claim success on failure' : 'retains declined pair and no-repeat history'}`, async () => {
    const writes = [];
    const db = { from(table) {
      return {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: { circle_id: null, status: 'pending' } }; },
        update(value) { writes.push({ table, value }); return this; },
        async upsert(value) { writes.push({ table, value }); return {}; },
        then(resolve) { return Promise.resolve({ error: fails ? { code: 'test' } : null }).then(resolve); },
      };
    } };
    const route = await loadTs('app/api/friend/disconnect/route.ts', {
      'next/server': nextMock, '@/lib/auth': { getCurrentUser: async () => ({ id: 'a' }) },
      '@/lib/supabase': { supabaseAdmin: db },
    });
    const response = await route.POST({ json: async () => ({ otherId: 'b' }) });
    assert.equal(response.status, fails ? 503 : 200);
    assert.equal(writes[0].value.status, 'declined');
    assert.equal(writes.some(w => w.table === 'friend_match_history'), !fails);
  });
}
