import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { realtimeCspSource, chatPollDelay } from '../lib/realtime-policy.ts';
import { rosterSnapshotChanged } from '../lib/roster-snapshot.ts';
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('CSP permits only the configured secure realtime host', () => {
  assert.equal(realtimeCspSource('https://project.supabase.co'), 'wss://project.supabase.co');
  assert.equal(realtimeCspSource('https://custom.example:8443/path?key=private'), 'wss://custom.example:8443');
  for (const value of [undefined, '', 'https://', 'http://localhost:54321', 'javascript:alert(1)', 'https://user:password@example.com']) {
    assert.equal(realtimeCspSource(value), '');
  }
  assert.match(source('proxy.ts'), /realtimeCspSource\(process.env.NEXT_PUBLIC_SUPABASE_URL\)/);
});

test('HTTP polling stays fast until realtime is actually subscribed', () => {
  assert.equal(chatPollDelay(false), 3000);
  assert.equal(chatPollDelay(true), 30000);
  assert.equal(chatPollDelay(false, false), 45000);
  assert.equal(chatPollDelay(false, true, 5000), 5000);
  const hook = source('lib/use-chat-realtime.ts');
  assert.match(hook, /status === 'SUBSCRIBED' \? topic : null/);
  assert.match(hook, /catch \{/);
  assert.match(hook, /removeChannel\(channel\).catch/);
  for (const path of ['app/match/[id]/chat-room.tsx', 'app/friends/friend-hub-client.tsx']) {
    assert.doesNotMatch(source(path), /realtimeTopic \? 30_?000/i);
  }
});

test('fresh short and empty rosters persist newly displayed candidates', () => {
  assert.equal(rosterSnapshotChanged([], ['a']), true);
  assert.equal(rosterSnapshotChanged(['a'], ['a', 'b']), true);
  assert.equal(rosterSnapshotChanged(['a', 'b'], ['a', 'c']), true);
  assert.equal(rosterSnapshotChanged(['a', 'b'], ['a']), true);
  assert.equal(rosterSnapshotChanged(['a', 'b'], ['b', 'a']), true);
  assert.equal(rosterSnapshotChanged(['a', 'b'], ['a', 'b']), false);
  assert.equal(rosterSnapshotChanged([], []), false);
  const route = source('app/api/match/roster/route.ts');
  assert.match(route, /persist = rosterSnapshotChanged\(snapshot, orderedIds\)/);
  assert.match(route, /if \(snapshotError\) throw/);
});

test('selection distinguishes failed verification from stale roster and closes stale previews', () => {
  const api = source('app/api/match/pick/route.ts');
  assert.match(api, /if \(exposureError\)[\s\S]*roster_check_unavailable/);
  assert.match(api, /code: 'matching_paused'/);
  const ui = source('app/dashboard/roster-picker.tsx');
  assert.match(ui, /setPreviewCandidate\(null\);\s+setNotice\(res.status === 401/);
  assert.match(ui, /permission_denied/);
});

test('expired sessions do not write cookies during Server Component rendering', () => {
  const auth = source('lib/auth.ts');
  const reader = auth.split('export async function getCurrentUser()')[1].split('export async function destroySession()')[0];
  assert.doesNotMatch(reader, /cookieStore\.(delete|set)\(/);
  assert.match(reader, /new Date\(session.expires_at\) < new Date\(\)/);
});

test('invalid successful responses cannot silently clear existing chat or roster state', () => {
  assert.match(source('app/match/[id]/chat-room.tsx'), /if \(!Array.isArray\(data.messages\)\) throw/);
  assert.match(source('app/dashboard/roster-picker.tsx'), /if \(!Array.isArray\(data.roster\)\) throw/);
});
