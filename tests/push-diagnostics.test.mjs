import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

for (const [reason, delivered, expected] of [
  ['delivered', true, 'sent'], ['no_subscription', false, 'skipped'],
  ['subscription_expired', false, 'skipped'], ['push_not_configured', false, 'failed'],
  ['push_provider_retryable', false, 'failed'], ['push_provider_rejected', false, 'failed'],
]) {
  test(`Love push ledger distinguishes ${reason}`, async () => {
    let update;
    const ledger = await loadTs('lib/love-notification-ledger.ts', {
      '@/lib/supabase': { supabaseAdmin: { from() { return {
        update(value) { update = value; return this; }, async in() { return {}; },
      }; } } },
    });
    await ledger.markLovePushResult(['event'], { delivered, retryable: false, reason });
    assert.equal(update.status, expected);
    assert.equal(update.error_code, delivered ? null : reason);
  });
}

for (const [statusCode, expected, retryable] of [[undefined, 'push_provider_retryable', true], [429, 'push_provider_retryable', true], [503, 'push_provider_retryable', true], [403, 'push_provider_rejected', false], [410, 'subscription_expired', false]]) {
  test(`push transport classifies ${statusCode ?? 'network failure'} without sending`, async () => {
    const saved = [process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY];
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'synthetic';
    process.env.VAPID_PRIVATE_KEY = 'synthetic';
    let pruned = false;
    try {
      const push = await loadTs('lib/push.ts', {
        'web-push': { default: { setVapidDetails() {}, async sendNotification() { throw { statusCode }; } } },
        '@/lib/supabase': { supabaseAdmin: { from() { return {
          select() { return this; }, delete() { pruned = true; return this; },
          async eq() { return { data: [{ id: 'device', endpoint: 'https://example.invalid', p256dh: 'test', auth: 'test' }] }; },
        }; } } },
      });
      const result = await push.sendPushToUserDetailed('test', { title: 'test' });
      assert.equal(result.reason, expected);
      assert.equal(result.retryable, retryable);
      assert.equal(result.delivered, false);
      assert.equal(pruned, statusCode === 410);
    } finally {
      for (const [index, key] of ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'].entries()) {
        if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index];
      }
    }
  });
}
