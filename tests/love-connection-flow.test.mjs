import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOVE_MAX_CONNECTIONS, LOVE_ROSTER_OPTIONS } from '../lib/matching-policy.ts';

test('Love Line exposes five choices and reserves at most three pending or mutual connections', () => {
  const pick = readFileSync(new URL('../app/api/match/pick/route.ts', import.meta.url), 'utf8');
  assert.equal(LOVE_ROSTER_OPTIONS, 5);
  assert.equal(LOVE_MAX_CONNECTIONS, 3);
  assert.match(pick, /create_capacity_pending_match/);
  assert.match(pick, /p_max_connections: MAX_CONNECTIONS/);
  assert.match(pick, /await acceptMatch\(matchId, user\.id\)/);
});

test('a pick notifies the other person and mutual acceptance notifies both', () => {
  const actions = readFileSync(new URL('../lib/match-actions.ts', import.meta.url), 'utf8');
  assert.match(actions, /chose you 👀/);
  assert.match(actions, /Say yes back to make it mutual and open the chat/);
  assert.match(actions, /sendInterestNudge/);
  assert.match(actions, /sendItsAMatchEmails/);
  assert.match(actions, /idempotencyKey: `match-interest-/);
  assert.match(actions, /idempotencyKey: `mutual-match-/);
  assert.match(actions, /Promise\.all\(\[\s*sendPushToUser\(match\.user_1_id/);
  assert.match(actions, /sendPushToUser\(match\.user_2_id/);
});

test('roster rotation email retries are idempotent', () => {
  const rematch = readFileSync(new URL('../app/api/cron/rematch/route.ts', import.meta.url), 'utf8');
  assert.match(rematch, /idempotencyKey: `roster-rotation-/);
  assert.match(rematch, /value: 'roster_rotation'/);
});

test('admin engagement metrics exclude test accounts and show notification reach', () => {
  const route = readFileSync(new URL('../app/api/admin/pools/route.ts', import.meta.url), 'utf8');
  assert.match(route, /\.not\('is_test', 'is', true\)/);
  assert.match(route, /loggedIn24h/);
  assert.match(route, /loggedIn48h/);
  assert.match(route, /loggedIn12d/);
  assert.match(route, /emailReachable12d/);
  assert.match(route, /pushReachable12d/);
  assert.match(route, /rosterNotified7d/);
});

test('Love dashboard keeps pending and mutual people in one filterable connection inbox', () => {
  const dashboard = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  const inbox = readFileSync(new URL('../app/dashboard/love-connections.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /<LoveConnections/);
  assert.doesNotMatch(dashboard, /className=\{styles\.loveChatPanel\}/);
  assert.match(inbox, /your-move/);
  assert.match(inbox, /chatting/);
  assert.match(inbox, /waiting/);
  assert.match(inbox, /free spot/);
  assert.match(inbox, /<EndMatchDialog/);
});

test('phone match room separates chat, plan, and profile below the measured PWA nav', () => {
  const room = readFileSync(new URL('../app/match/[id]/chat-room.tsx', import.meta.url), 'utf8');
  const roomCss = readFileSync(new URL('../app/match/[id]/chat.module.css', import.meta.url), 'utf8');
  const nav = readFileSync(new URL('../components/top-nav.tsx', import.meta.url), 'utf8');
  assert.match(room, /'chat' \| 'plan' \| 'profile'/);
  assert.match(room, /data-mobile-panel=\{mobilePanel\}/);
  assert.match(room, /role="tablist"/);
  assert.match(room, /mutual=\{!!\(liveMatch\?\.user_1_accepted/);
  assert.match(roomCss, /var\(--app-top-nav-height/);
  assert.match(roomCss, /data-mobile-panel='plan'/);
  assert.match(roomCss, /data-mobile-panel='profile'/);
  assert.match(nav, /ResizeObserver/);
});

test('ending a Love connection closes it and immediately returns both slots to the pool', () => {
  const route = readFileSync(new URL('../app/api/matches/[id]/end/route.ts', import.meta.url), 'utf8');
  const dialog = readFileSync(new URL('../components/end-match-dialog.tsx', import.meta.url), 'utf8');
  assert.match(route, /status: 'ended'/);
  assert.match(route, /status: 'waiting'/);
  assert.match(route, /match_history/);
  assert.match(dialog, /Your spot opens immediately/);
  assert.match(dialog, /end &amp; free spot/);
});
