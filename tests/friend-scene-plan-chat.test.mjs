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
