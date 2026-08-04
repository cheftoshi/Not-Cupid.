import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSafeImageType,
  isManagedStorageUrl,
  timingSafeStringEqual,
} from '../lib/request-security.ts';
import { hashOtp } from '../lib/otp.ts';

test('secret comparison rejects missing and altered values', () => {
  assert.equal(timingSafeStringEqual(null, 'expected'), false);
  assert.equal(timingSafeStringEqual('expected', 'expected'), true);
  assert.equal(timingSafeStringEqual('expectee', 'expected'), false);
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

test('OTP storage value is deterministic and never contains the code', () => {
  process.env.MATCH_LINK_SECRET = 'test-secret-that-is-long-enough';
  const first = hashOtp('user@example.com', '123456');
  const second = hashOtp('user@example.com', '123456');
  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.equal(first.includes('123456'), false);
});
