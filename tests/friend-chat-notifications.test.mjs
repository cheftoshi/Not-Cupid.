import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Friend group messages push immediately and open the exact conversation', () => {
  const clubRoute = source('app/api/friend/clubs/[id]/messages/route.ts');
  const packRoute = source('app/api/friend/messages/route.ts');
  const client = source('app/friends/friend-hub-client.tsx');
  assert.match(clubRoute, /url: `\/friends\?view=pulse&club=\$\{encodeURIComponent\(id\)\}`/);
  assert.match(packRoute, /url: '\/friends\?view=crew&chat=pack'/);
  assert.match(clubRoute, /markFriendChatRead\(user\.id, 'club', id\)/);
  assert.match(packRoute, /markFriendChatRead\(user\.id, 'circle', circleId\)/);
  assert.match(client, /URLSearchParams\(window\.location\.search\)\.get\('club'\)/);
  assert.match(client, /URLSearchParams\(window\.location\.search\)\.get\('chat'\) === 'pack'/);
  assert.match(client, /clubUnreadTotal/);
  assert.match(client, /crewUnreadTotal/);
});

test('Friend chat read state permits one email per unread period and starts historical chats clean', () => {
  const migration = source('supabase/migrations/20260817134000_friend_chat_unread_notifications.sql');
  const read = source('lib/friend-chat-read.ts');
  assert.match(migration, /create table if not exists public\.friend_chat_reads/);
  assert.match(migration, /email_notified_at timestamptz/);
  assert.match(migration, /and email_notified_at is null/);
  assert.match(migration, /email_attempted_at < p_now - interval '1 hour'/);
  assert.match(migration, /Existing users start clean/);
  assert.match(migration, /revoke all on table public\.friend_chat_reads from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.friend_chat_reads to service_role/);
  assert.match(read, /email_notified_at: null/);
  assert.match(read, /email_attempted_at: null/);
});

test('12-hour Friend chat email is concise, preference-aware, and approval-gated', () => {
  const notifications = source('lib/friend-chat-notifications.ts');
  const cron = source('app/api/cron/friend-chat-unread/route.ts');
  const admin = source('app/api/admin/friend-chat-notifications/route.ts');
  const adminClient = source('app/admin/admin-client.tsx');
  const vercel = source('vercel.json');
  assert.match(notifications, /FRIEND_CHAT_EMAIL_DELAY_HOURS = 12/);
  assert.match(notifications, /email_notifications !== false/);
  assert.match(notifications, /!user\.notifications_paused_at/);
  assert.match(notifications, /email_notified_at\) continue/);
  assert.match(notifications, /We waited 12 hours before sending this reminder so your inbox stays quiet\./);
  assert.match(notifications, /FRIEND_CHAT_EMAILS_ENABLED === 'true'/);
  assert.match(notifications, /FRIEND_CHAT_EMAIL_TEMPLATE_VERSION/);
  assert.match(notifications, /opts\.send === true && activation\.enabled/);
  assert.match(cron, /runFriendChatUnreadNotifications\(\{ send: activation\.enabled \}\)/);
  assert.match(admin, /runFriendChatUnreadNotifications\(\{ send: false \}\)/);
  assert.doesNotMatch(admin, /export async function POST/);
  assert.match(adminClient, /12-hour chat email fallback/);
  assert.match(adminClient, /Read-only preview\. There is no send button/);
  assert.match(vercel, /"path": "\/api\/cron\/friend-chat-unread"/);
  assert.match(vercel, /"schedule": "5 \* \* \* \*"/);
});
