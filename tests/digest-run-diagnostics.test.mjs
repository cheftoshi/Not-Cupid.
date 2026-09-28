import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

test('digest previews never write; scheduler empty/disabled/error outcomes are durable without sending', async () => {
  const rows = [];
  let enabled = true, windowOpen = true, broken = false;
  const module = await loadTs('lib/daily-activity-digest.ts', {
    '@/lib/email': { sendEmail: () => { throw Error('No email allowed in diagnostics'); } },
    '@/lib/email-address': { defaultEmailReplyTo: () => 'test@example.invalid', looksLikePublicPostalAddress: () => true },
    '@/lib/daily-activity-email': {
      DAILY_ACTIVITY_EMAIL_APPROVAL_VERSION: 'test', DAILY_ACTIVITY_EMAIL_HOUR_ET: 13, DAILY_ACTIVITY_EMAIL_WINDOW_MINUTES: 15,
      DAILY_ACTIVITY_EMAIL_SUBJECT: 'test', dailyActivityContentKey: () => 'key', dailyActivityCounts: () => ({}),
      dailyActivityEasternDay: () => '2026-10-02', dailyActivityEmailActivation: () => ({ enabled }),
      dailyActivityEmailHtml: () => '', isDailyActivitySendWindow: () => windowOpen,
    },
    '@/lib/friend-matching': { isLgbtqIdentity: () => false }, '@/lib/quiz-data': { metroOf: () => 'boston' },
    '@/lib/supabase': { supabaseAdmin: { from: table => ({ insert: async row => {
      assert.equal(table, 'activity_digest_runs'); rows.push(row); return { error: null };
    } }) } },
    '@/lib/supabase-pagination': { fetchAllSupabaseRows: async () => { if (broken) throw Error('Private provider detail'); return []; } },
  });
  await module.runDailyActivityDigest({ send: false }); assert.equal(rows.length, 0);
  await module.runDailyActivityDigest({ send: true, recordRun: true }); assert.equal(rows.at(-1).status, 'empty');
  enabled = false; await module.runDailyActivityDigest({ send: false, recordRun: true }); assert.equal(rows.at(-1).status, 'disabled');
  enabled = true; windowOpen = false; await module.runDailyActivityDigest({ send: true, recordRun: true }); assert.equal(rows.at(-1).status, 'outside_window');
  broken = true; await assert.rejects(() => module.runDailyActivityDigest({ send: true, recordRun: true }));
  assert.deepEqual(rows.at(-1), { status: 'error' }); assert.equal(JSON.stringify(rows).includes('Private'), false);
});
