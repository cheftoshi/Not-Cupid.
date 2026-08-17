import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dailyActivityEasternDay, isDailyActivitySendWindow } from '../lib/daily-activity-cadence.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('daily activity email is one compact Love + Friend template', () => {
  const email = source('lib/daily-activity-email.ts');
  assert.match(email, /DAILY_ACTIVITY_EMAIL_SUBJECT = 'You have something waiting on NotCupid'/);
  assert.match(email, /Here’s what’s waiting for you\./);
  assert.match(email, /A quick daily drop of activity you haven’t opened yet\./);
  assert.match(email, /Love Line/);
  assert.match(email, /Friend Hub/);
  assert.match(email, /Plans near you/);
  assert.match(email, /Sent at most once a day—and only when there’s something new or unread\./);
  assert.match(email, /NotCupid · operated by Lemon Labs ·/);
  assert.doesNotMatch(email, /instagram\.com|tiktok\.com|x\.com/);
});

test('daily delivery is version-gated and has no manual send endpoint', () => {
  const email = source('lib/daily-activity-email.ts');
  const cadence = source('lib/daily-activity-cadence.ts');
  const cron = source('app/api/cron/daily-activity/route.ts');
  const admin = source('app/api/admin/daily-activity-email/route.ts');
  const vercel = source('vercel.json');
  const adminUi = source('app/admin/admin-client.tsx');
  assert.match(email, /DAILY_ACTIVITY_EMAILS_ENABLED === 'true'/);
  assert.match(email, /DAILY_ACTIVITY_EMAIL_TEMPLATE_VERSION/);
  assert.match(cadence, /DAILY_ACTIVITY_EMAIL_WINDOW_MINUTES = 15/);
  assert.match(cadence, /Number\(parts\.minute\) < DAILY_ACTIVITY_EMAIL_WINDOW_MINUTES/);
  assert.match(cron, /runDailyActivityDigest\(\{ send: activation\.enabled \}\)/);
  assert.match(admin, /runDailyActivityDigest\(\{ send: false \}\)/);
  assert.match(vercel, /"path": "\/api\/cron\/daily-activity"/);
  assert.match(vercel, /"schedule": "0,5,10 17,18 \* \* \*"/);
  assert.doesNotMatch(vercel, /friend-digest|friend-chat-unread/);
  assert.doesNotMatch(adminUi, /send-friend-digest|Send friend digest now/);
});

test('scheduled and manual daily drops are locked to 1:00–1:14 PM New York time', () => {
  assert.equal(isDailyActivitySendWindow(new Date('2026-08-18T16:59:59Z')), false);
  assert.equal(isDailyActivitySendWindow(new Date('2026-08-18T17:00:00Z')), true);
  assert.equal(isDailyActivitySendWindow(new Date('2026-08-18T17:14:59Z')), true);
  assert.equal(isDailyActivitySendWindow(new Date('2026-08-18T17:15:00Z')), false);
  assert.equal(isDailyActivitySendWindow(new Date('2026-08-18T18:00:00Z')), false);
  assert.equal(isDailyActivitySendWindow(new Date('2026-12-18T17:00:00Z')), false);
  assert.equal(isDailyActivitySendWindow(new Date('2026-12-18T18:00:00Z')), true);
  assert.equal(dailyActivityEasternDay(new Date('2026-08-18T03:59:59Z')), '2026-08-17');
  assert.equal(dailyActivityEasternDay(new Date('2026-08-18T04:00:00Z')), '2026-08-18');
});

test('daily audience is preference-aware, realm-safe, actionable, and direct-linked', () => {
  const digest = source('lib/daily-activity-digest.ts');
  assert.match(digest, /user\.is_test !== true/);
  assert.match(digest, /user\.email_notifications !== false/);
  assert.match(digest, /!user\.notifications_paused_at/);
  assert.match(digest, /dailyActivityEasternDay\(new Date\(user\.activity_digest_sent_at\)\) !== easternDay/);
  assert.match(digest, /isDailyActivitySendWindow\(now\)/);
  assert.match(digest, /other\.is_test === true/);
  assert.match(digest, /kind: 'love_interest'/);
  assert.match(digest, /kind: 'love_message'/);
  assert.match(digest, /kind: 'club_chat'/);
  assert.match(digest, /kind: 'pack_chat'/);
  assert.match(digest, /kind: 'friend_dm'/);
  assert.match(digest, /kind: 'plan_chat'/);
  assert.match(digest, /kind: 'new_plan'/);
  assert.match(digest, /view=scene&plan=/);
  assert.match(digest, /view=pulse&club=/);
  assert.match(digest, /activity_digest_deliveries/);
  assert.match(digest, /idempotencyKey: `daily-activity-/);
});

test('digest migration provides idempotency and plan-chat read cursors', () => {
  const migration = source('supabase/migrations/20260817161455_daily_activity_digest.sql');
  const dayLock = source('supabase/migrations/20260817173351_daily_activity_delivery_day_lock.sql');
  assert.match(migration, /activity_digest_sent_at/);
  assert.match(migration, /create table if not exists public\.activity_digest_deliveries/);
  assert.match(migration, /unique \(user_id, content_key\)/);
  assert.match(migration, /create table if not exists public\.friend_plan_chat_reads/);
  assert.match(migration, /primary key \(activity_id, user_id\)/);
  assert.match(migration, /grant select, insert, update, delete on table public\.activity_digest_deliveries to service_role/);
  assert.match(migration, /grant select, insert, update, delete on table public\.friend_plan_chat_reads to service_role/);
  assert.match(dayLock, /add column if not exists delivery_day date/);
  assert.match(dayLock, /activity_digest_deliveries_user_day_uq/);
  assert.match(dayLock, /\(user_id, delivery_day\)/);
  assert.match(dayLock, /at time zone 'America\/New_York'/);
});

test('opening or joining a plan conversation advances its read cursor', () => {
  const comments = source('app/api/friend/activities/[id]/comments/route.ts');
  const rsvp = source('app/api/friend/activities/[id]/rsvp/route.ts');
  const create = source('app/api/friend/activities/route.ts');
  assert.match(comments, /from\('friend_plan_chat_reads'\)\.upsert/);
  assert.match(rsvp, /if \(myResponse === 'yes'\)/);
  assert.match(rsvp, /from\('friend_plan_chat_reads'\)\.upsert/);
  assert.match(create, /from\('friend_plan_chat_reads'\)\.upsert/);
});

test('Love message push stays immediate while email folds into the daily drop after activation', () => {
  const messages = source('app/api/messages/route.ts');
  const pushIndex = messages.indexOf('await sendPushToUser(recipientId');
  const activationIndex = messages.indexOf('dailyActivityEmailActivation().enabled');
  assert.ok(pushIndex >= 0 && activationIndex > pushIndex);
  assert.match(messages, /if \(dailyActivityEmailActivation\(\)\.enabled\) return/);
  assert.match(messages, /idempotencyKey: `chat-message-/);
});
