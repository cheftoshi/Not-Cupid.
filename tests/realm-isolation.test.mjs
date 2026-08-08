import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sameRealm } from '../lib/realm.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('realm comparison treats only explicit is_test=true as the test realm', () => {
  assert.equal(sameRealm({ is_test: true }, { is_test: true }), true);
  assert.equal(sameRealm({ is_test: false }, { is_test: null }), true);
  assert.equal(sameRealm({ is_test: false }, {}), true);
  assert.equal(sameRealm({ is_test: true }, { is_test: false }), false);
  assert.equal(sameRealm({ is_test: true }, {}), false);
});

test('Friend assignment applies the realm boundary in the database query and in memory', () => {
  const friendAssign = source('lib/friend-assign.ts');
  assert.match(friendAssign, /select\('[^']*is_test[^']*'\)/);
  assert.match(friendAssign, /\.or\(meTest \? 'is_test\.eq\.true' : 'is_test\.is\.null,is_test\.eq\.false'\)/);
  assert.match(friendAssign, /sameRealm\(me, p as any\)/);
});

test('Friend interaction routes fail closed across realms', () => {
  const routes = [
    'app/api/friend/connect/route.ts',
    'app/api/friend/dm/route.ts',
    'app/api/friend/messages/route.ts',
    'app/api/friend/activities/[id]/comments/route.ts',
    'app/api/friend/activities/[id]/rsvp/route.ts',
  ];
  for (const route of routes) {
    assert.match(source(route), /sameRealm\(/, `${route} must enforce realm isolation`);
  }
  const crewMessages = source('app/api/friend/messages/route.ts');
  assert.match(crewMessages, /const invalidRealm =/);
  assert.match(crewMessages, /const recipientIds = realmMemberIds\.filter/);
});

test('Love surfaces hide legacy cross-realm records', () => {
  assert.match(source('app/dashboard/page.tsx'), /safeHistoryMatches/);
  assert.match(source('app/dashboard/page.tsx'), /sameRealm\(user, historyOtherById\.get\(otherId\)\)/);
  assert.match(source('app/match/[id]/page.tsx'), /!sameRealm\(user, otherUser\)/);
});

test('test seeder owns a canonical namespace and stamps Scene realm fields', () => {
  const seeder = source('app/api/admin/seed-test/route.ts');
  assert.match(seeder, /FIXTURE_EMAIL_SUFFIX = '\+test@notcupid\.dev'/);
  assert.match(seeder, /staleFixtureIds/);
  assert.match(seeder, /deleted_at: now/);
  assert.match(seeder, /friend_pro_until: null/);
  assert.match(seeder, /from\('otp_codes'\)\.delete\(\)\.in\('email', fixtureEmails\)/);
  assert.match(seeder, /metro: metroOf\(S\[ev\.author\]\.zip\), is_test: true/);
  assert.match(seeder, /accountCount: S\.length/);
});

test('database migration rejects cross-realm Love and Friend pairs', () => {
  const migration = source('supabase/legacy-migrations/20260804_realm_isolation.sql');
  assert.match(migration, /create trigger matches_same_realm/);
  assert.match(migration, /create trigger friend_connections_same_realm/);
  assert.match(migration, /coalesce\(first_user\.is_test, false\) is distinct from coalesce\(second_user\.is_test, false\)/);
  assert.equal((migration.match(/count\(distinct coalesce\(app_user\.is_test, false\)\)/g) ?? []).length, 2);
});
