import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import {loadTs} from './helpers/load-ts.mjs';

const bearer = 'synthetic-session-bearer';
const hash = crypto.createHash('sha256').update(bearer).digest('hex');

async function fixture(presented = bearer, changes = {}, userChanges = {}) {
  const sessions = [{token: hash, token_hash_version: 1, user_id: 'test-user',
    expires_at: new Date(Date.now() + 600_000).toISOString(), ...changes}];
  const user = {id: 'test-user', deleted_at: null, is_blocked: false, ...userChanges};
  const store = new Map(presented ? [['nc_session', presented]] : []);
  const db = {from(table) {
    let predicates = [], operation = 'read', values;
    const q = {
      select() { return q; }, limit() { return q; },
      eq(k, v) { predicates.push(r => r[k] === v); return q; },
      neq(k, v) { predicates.push(r => r[k] !== v); return q; },
      is(k, v) { predicates.push(r => (r[k] ?? null) === v); return q; },
      in(k, v) { predicates.push(r => v.includes(r[k])); return q; },
      update(v) { operation = 'update'; values = v; return q; },
      delete() { operation = 'delete'; return q; },
      async run() {
        const rows = table === 'sessions' ? sessions : [user];
        const found = rows.filter(r => predicates.every(p => p(r)));
        if (operation === 'update') found.forEach(r => Object.assign(r, values));
        if (operation === 'delete') found.forEach(r => rows.splice(rows.indexOf(r), 1));
        return {data: found[0] ?? null, error: null};
      },
      single() { return q.run(); },
      then(resolve, reject) { return q.run().then(resolve, reject); },
    };
    return q;
  }};
  const auth = await loadTs('lib/auth.ts', {
    crypto,
    'next/headers': {cookies: async () => ({
      get: k => store.has(k) ? {value: store.get(k)} : undefined,
      delete: k => store.delete(k),
    })},
    '@/lib/supabase': {supabaseAdmin: db},
  });
  return {auth, sessions, store};
}

test('session accepts the original bearer, never the stored hash', async () => {
  assert.equal((await (await fixture()).auth.getCurrentUser()).id, 'test-user');
  const leaked = await fixture(hash);
  assert.equal(await leaked.auth.getCurrentUser(), null);
  assert.equal(leaked.sessions[0].token, hash);
});

test('session rejects plaintext legacy rows and unknown hash versions', async () => {
  for (const changes of [{token: bearer, token_hash_version: 0}, {token_hash_version: 0}, {token_hash_version: 2}]) {
    assert.equal(await (await fixture(bearer, changes)).auth.getCurrentUser(), null);
  }
});

test('session fails closed for missing credentials, invalid expiry, deleted or blocked accounts', async () => {
  assert.equal(await (await fixture(null)).auth.getCurrentUser(), null);
  for (const expires_at of ['invalid', null, new Date(Date.now() - 1000).toISOString()]) {
    const f = await fixture(bearer, {expires_at});
    assert.equal(await f.auth.getCurrentUser(), null);
    assert.equal(f.sessions.length, 0);
    assert.equal(f.store.get('nc_session'), bearer, 'Server Component reads must not mutate cookies');
  }
  for (const changes of [{deleted_at: new Date().toISOString()}, {is_blocked: true}]) {
    assert.equal(await (await fixture(bearer, {}, changes)).auth.getCurrentUser(), null);
  }
});

test('logout revokes original bearer but cannot revoke by presenting its database hash', async () => {
  const normal = await fixture();
  await normal.auth.destroySession();
  assert.equal(normal.sessions.length, 0);
  assert.equal(normal.store.has('nc_session'), false);
  const leaked = await fixture(hash);
  await leaked.auth.destroySession();
  assert.equal(leaked.sessions.length, 1);
  assert.equal(leaked.store.has('nc_session'), false);
});
