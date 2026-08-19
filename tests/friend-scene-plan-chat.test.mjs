import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Scene plans open a participant-only organizer chat after an interested RSVP', () => {
  const client = source('app/friends/friend-hub-client.tsx');
  const comments = source('app/api/friend/activities/[id]/comments/route.ts');

  assert.match(client, /a\.isMine \|\| a\.myResponse === 'yes'/);
  assert.match(client, /talk to the organizer/);
  assert.match(client, /Choose “I’m interested” to open the plan chat\./);
  assert.match(comments, /response\?\.response === 'yes'/);
  assert.match(comments, /RSVP interested to join this plan chat\./);
  assert.match(comments, /friend_plan_chat_reads/);
});

test('Plan-chat replies notify the organizer and interested participants with an exact deep link', () => {
  const comments = source('app/api/friend/activities/[id]/comments/route.ts');
  const rsvp = source('app/api/friend/activities/[id]/rsvp/route.ts');
  const client = source('app/friends/friend-hub-client.tsx');

  assert.match(comments, /new Set<string>\(\[act\.author_id/);
  assert.match(comments, /\.eq\('response', 'yes'\)/);
  assert.match(comments, /url: `\/friends\?view=scene&plan=\$\{encodeURIComponent\(id\)\}`/);
  assert.match(comments, /tag: `friend-plan-chat-\$\{id\}`/);
  assert.match(rsvp, /url: `\/friends\?view=scene&plan=\$\{encodeURIComponent\(activityId\)\}`/);
  assert.match(client, /scene-plan-\$\{planId\}/);
  assert.match(client, /autoOpenChat=\{deepLinkedPlan === a\.id\}/);
});

test('Friend picks, circles, and RSVP capacity transition atomically in Postgres', () => {
  const connect = source('app/api/friend/connect/route.ts');
  const rsvp = source('app/api/friend/activities/[id]/rsvp/route.ts');
  const migration = source('supabase/migrations/20260819050000_experiment_selection_safety.sql');

  assert.match(connect, /rpc\('pick_friend_connection'/);
  assert.match(rsvp, /rpc\('set_friend_activity_rsvp'/);
  assert.match(migration, /create or replace function public\.join_friend_circle/);
  assert.match(migration, /create or replace function public\.pick_friend_connection/);
  assert.match(migration, /create or replace function public\.set_friend_activity_rsvp/);
  assert.match(migration, /for update/i);
  assert.match(migration, /friend_circle_members_one_active_user_idx/);
});

test('Friend message retries use sender-scoped idempotency keys', () => {
  const migration = source('supabase/migrations/20260819050000_experiment_selection_safety.sql');
  const routes = [
    source('app/api/friend/messages/route.ts'),
    source('app/api/friend/activities/[id]/comments/route.ts'),
    source('app/api/friend/dm/route.ts'),
    source('app/api/friend/clubs/[id]/messages/route.ts'),
  ];

  for (const table of ['friend_messages', 'friend_activity_comments', 'friend_dms', 'friend_club_messages']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} add column if not exists client_id text`));
  }
  assert.match(migration, /friend_messages_sender_client_id_idx/);
  assert.match(migration, /friend_activity_comments_user_client_id_idx/);
  assert.match(migration, /friend_dms_sender_client_id_idx/);
  assert.match(migration, /friend_club_messages_sender_client_id_idx/);
  for (const route of routes) assert.match(route, /client_?id|clientId/);
});
