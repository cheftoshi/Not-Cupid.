import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  detectSafeImageType,
  isAllowedWebPushEndpoint,
  isManagedStorageUrl,
  timingSafeStringEqual,
} from '../lib/request-security.ts';
import { hashOtp } from '../lib/otp.ts';

test('secret comparison rejects missing and altered values', () => {
  assert.equal(timingSafeStringEqual(null, 'expected'), false);
  assert.equal(timingSafeStringEqual('expected', 'expected'), true);
  assert.equal(timingSafeStringEqual('expectee', 'expected'), false);
});

test('web push subscriptions are limited to known browser push services', () => {
  assert.equal(isAllowedWebPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'), true);
  assert.equal(isAllowedWebPushEndpoint('https://web.push.apple.com/Q123'), true);
  assert.equal(isAllowedWebPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'), true);
  assert.equal(isAllowedWebPushEndpoint('https://127.0.0.1/internal'), false);
  assert.equal(isAllowedWebPushEndpoint('https://example.com/callback'), false);
  assert.equal(isAllowedWebPushEndpoint('https://fcm.googleapis.com:8443/fcm/send/abc'), false);
});

test('image detection uses bytes instead of client filenames', () => {
  assert.deepEqual(detectSafeImageType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), { mime: 'image/jpeg', ext: 'jpg' });
  assert.deepEqual(
    detectSafeImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    { mime: 'image/png', ext: 'png' },
  );
  assert.equal(detectSafeImageType(Buffer.from('<html>not an image</html>')), null);
});

test('managed video URLs cannot leave the expected user prefix', () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  assert.equal(
    isManagedStorageUrl(
      'https://project.supabase.co/storage/v1/object/public/raffle-videos/profile/user-1/123.mp4',
      'raffle-videos',
      'profile/user-1/',
    ),
    true,
  );
  assert.equal(
    isManagedStorageUrl('https://evil.example/video.mp4', 'raffle-videos', 'profile/user-1/'),
    false,
  );
  assert.equal(
    isManagedStorageUrl(
      'https://project.supabase.co/storage/v1/object/public/raffle-videos/profile/user-2/123.mp4',
      'raffle-videos',
      'profile/user-1/',
    ),
    false,
  );
});

test('account deactivation is transactional and only clears the session after success', () => {
  const route = readFileSync(new URL('../app/api/profile/delete/route.ts', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/20260819043331_atomic_profile_deactivation.sql', import.meta.url), 'utf8');
  assert.match(route, /rpc\('deactivate_notcupid_account'/);
  assert.match(route, /if \(error \|\| deactivated !== true\)/);
  assert.match(route, /await destroySession\(\)/);
  assert.doesNotMatch(route, /from\('users'\)[\s\S]*status: 'deleted'/);
  assert.match(migration, /for update/i);
  assert.match(migration, /delete from public\.sessions/);
  assert.match(migration, /grant execute on function public\.deactivate_notcupid_account[\s\S]*to service_role/i);
});

test('blocking and reporting are atomic server-only account transitions', () => {
  const adminReports = readFileSync(new URL('../app/api/admin/reports/route.ts', import.meta.url), 'utf8');
  const report = readFileSync(new URL('../app/api/report/route.ts', import.meta.url), 'utf8');
  const auth = readFileSync(new URL('../lib/auth.ts', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/20260819043331_atomic_profile_deactivation.sql', import.meta.url), 'utf8');

  assert.match(adminReports, /rpc\('set_notcupid_account_blocked'/);
  assert.match(report, /rpc\('report_love_match'/);
  assert.match(migration, /create or replace function public\.set_notcupid_account_blocked/);
  assert.match(migration, /create or replace function public\.report_love_match/);
  assert.match(migration, /grant execute on function public\.set_notcupid_account_blocked[\s\S]*to service_role/i);
  assert.match(migration, /grant execute on function public\.report_love_match[\s\S]*to service_role/i);
  assert.match(auth, /is_blocked/);
  assert.match(auth, /deleted_at/);
});

test('Stripe fulfillment requires the exact paid checkout shape', () => {
  const webhook = readFileSync(new URL('../app/api/stripe-webhook/route.ts', import.meta.url), 'utf8');
  const lovePick = readFileSync(new URL('../lib/love-pick-access.ts', import.meta.url), 'utf8');
  assert.match(webhook, /session\?\.payment_status === 'paid'/);
  assert.match(webhook, /session\?\.status === 'complete'/);
  assert.match(webhook, /session\?\.mode === args\.mode/);
  assert.match(webhook, /session\?\.currency === 'usd'/);
  assert.match(webhook, /Number\(session\?\.amount_total\) === args\.amountCents/);
  assert.match(lovePick, /session\?\.status !== 'complete'/);
  assert.match(lovePick, /session\?\.mode !== 'payment'/);
});

test('OTP storage value is deterministic and never contains the code', () => {
  process.env.MATCH_LINK_SECRET = 'test-secret-that-is-long-enough';
  const first = hashOtp('user@example.com', '123456');
  const second = hashOtp('user@example.com', '123456');
  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.equal(first.includes('123456'), false);
});
