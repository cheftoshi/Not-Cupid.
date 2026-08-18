import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOVE_INCLUDED_PICKS, LOVE_MAX_CONNECTIONS, LOVE_ROSTER_OPTIONS } from '../lib/matching-policy.ts';

test('Love Line exposes seven choices, three included picks, and a hard safety ceiling', () => {
  const pick = readFileSync(new URL('../app/api/match/pick/route.ts', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/20260818143000_love_connection_picks.sql', import.meta.url), 'utf8');
  assert.equal(LOVE_ROSTER_OPTIONS, 7);
  assert.equal(LOVE_INCLUDED_PICKS, 3);
  assert.equal(LOVE_MAX_CONNECTIONS, 10);
  assert.match(pick, /create_love_pick/);
  assert.match(pick, /p_max_connections: MAX_CONNECTIONS/);
  assert.match(pick, /status: 402/);
  assert.match(pick, /p_access_type: accessType/);
  assert.match(pick, /await acceptMatch\(matchId, user\.id\)/);
  assert.match(migration, /v_included_used >= 3/);
  assert.match(migration, /p_access_type = 'paid'/);
  assert.match(migration, /unique \(user_id, candidate_id\)/);
});

test('every Love roster option has a free, phone-safe profile preview before choosing', () => {
  const route = readFileSync(new URL('../app/api/match/roster/route.ts', import.meta.url), 'utf8');
  const picker = readFileSync(new URL('../app/dashboard/roster-picker.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../app/dashboard/dashboard.module.css', import.meta.url), 'utf8');
  assert.match(route, /bio, prompts, relationship_style/);
  assert.match(route, /prompts: normalizeProfilePrompts/);
  assert.match(route, /interests: Array\.from\(new Set/);
  assert.match(picker, /view \{first\}&apos;s profile/);
  assert.match(picker, /role="dialog"/);
  assert.match(picker, /free roster profile/);
  assert.match(picker, /this profile is free/);
  assert.match(picker, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(css, /\.loveProfilePreviewSheet \{/);
  assert.match(css, /max-height: calc\(100dvh/);
  assert.match(css, /app-safe-bottom/);
});

test('a pick notifies the other person and mutual acceptance notifies both', () => {
  const actions = readFileSync(new URL('../lib/match-actions.ts', import.meta.url), 'utf8');
  assert.match(actions, /chose you 👀/);
  assert.match(actions, /Review their profile, then choose Yes or Pass/);
  assert.match(actions, /sendInterestNudge/);
  assert.match(actions, /sendItsAMatchEmails/);
  assert.match(actions, /idempotencyKey: `match-interest-/);
  assert.match(actions, /idempotencyKey: `mutual-match-/);
  assert.match(actions, /\[match\.user_1_id, match\.user_2_id\]\.map/);
  assert.match(actions, /claimLoveNotificationEvent/);
  assert.match(actions, /love_event_id/);
});

test('Love concierge records and deduplicates immediate, 24h, final, decision, and expiry events', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260818174000_love_concierge_event_ledger.sql', import.meta.url), 'utf8');
  const ledger = readFileSync(new URL('../lib/love-notification-ledger.ts', import.meta.url), 'utf8');
  const cron = readFileSync(new URL('../app/api/cron/expiring-soon/route.ts', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../app/dashboard/love-connections.tsx', import.meta.url), 'utf8');
  const stats = readFileSync(new URL('../app/api/admin-stats/route.ts', import.meta.url), 'utf8');
  assert.match(migration, /create table if not exists public\.love_notification_events/);
  assert.match(migration, /unique \(match_id, recipient_id, notification_type, channel\)/);
  assert.match(migration, /claim_love_notification_event/);
  assert.match(ledger, /recordLoveDecision/);
  assert.match(ledger, /recordLoveExpiry/);
  assert.match(cron, /decision_24h/);
  assert.match(cron, /decision_final/);
  assert.match(cron, /You have a Love Line choice waiting/);
  assert.match(cron, /Your Love Line choice closes soon/);
  assert.match(cron, /loveDashboardUrl/);
  assert.match(dashboard, /they chose you · decide yes or pass/);
  assert.match(dashboard, /review & decide/);
  assert.match(stats, /loveFunnel/);
  assert.match(stats, /peopleNeedToAnswer/);
});

test('roster rotation email retries are idempotent', () => {
  const rematch = readFileSync(new URL('../app/api/cron/rematch/route.ts', import.meta.url), 'utf8');
  assert.match(rematch, /idempotencyKey: `roster-rotation-/);
  assert.match(rematch, /value: 'roster_rotation'/);
});

test('chat notification email failures remain retryable and route retries are idempotent', () => {
  const messages = readFileSync(new URL('../app/api/messages/route.ts', import.meta.url), 'utf8');
  const email = readFileSync(new URL('../lib/email.ts', import.meta.url), 'utf8');
  assert.match(messages, /idempotencyKey: `chat-message-/);
  assert.match(messages, /if \(!emailResult\.ok\) return/);
  assert.match(messages, /notifyNewMessage\(match_id,[\s\S]*message\.id/);
  assert.match(email, /providerMessage: safeProviderMessage/);
  assert.match(email, /redacted-email/);
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
  assert.doesNotMatch(dashboard, /lockedOffers|profileUnlocked|unlockItems|LoveUnlockOffer/);
  assert.match(inbox, /your-move/);
  assert.match(inbox, /chatting/);
  assert.match(inbox, /waiting/);
  assert.match(inbox, />end</);
  assert.match(inbox, /<EndMatchDialog/);
  assert.match(inbox, /visible\.map\(\(connection\)/);
  assert.doesNotMatch(inbox, /LoveUnlockOffer|unlockItems|paywall/);
  const room = readFileSync(new URL('../app/match/[id]/chat-room.tsx', import.meta.url), 'utf8');
  assert.match(room, /Do you want to connect with/);
  assert.match(room, /answerIncomingChoice\('yes'\)/);
  assert.match(room, /answerIncomingChoice\('pass'\)/);
});

test('the full compatibility profile is included after mutual connection', () => {
  const page = readFileSync(new URL('../app/match/[id]/page.tsx', import.meta.url), 'utf8');
  const room = readFileSync(new URL('../app/match/[id]/chat-room.tsx', import.meta.url), 'utf8');
  assert.match(page, /visibleOtherUser = mutuallyConnected \? safeOtherUser : freeLoveProfileView/);
  assert.match(page, /profileUnlocked=\{mutuallyConnected\}/);
  assert.match(room, /full compatibility profile included/);
  assert.doesNotMatch(room, /unlock-checkout|unlock once · \$0\.99|unlockAvailable/);
});

test('extra connection checkout is person-specific, transparent, and idempotent', () => {
  const checkout = readFileSync(new URL('../app/api/match/connection-checkout/route.ts', import.meta.url), 'utf8');
  const complete = readFileSync(new URL('../app/api/match/connection-complete/route.ts', import.meta.url), 'utf8');
  const access = readFileSync(new URL('../lib/love-pick-access.ts', import.meta.url), 'utf8');
  const webhook = readFileSync(new URL('../app/api/stripe-webhook/route.ts', import.meta.url), 'utf8');
  const lintCleanup = readFileSync(new URL('../supabase/migrations/20260818144500_love_pick_lint_cleanup.sql', import.meta.url), 'utf8');
  assert.match(checkout, /Payments are disabled for test accounts/);
  assert.match(checkout, /Their profile stays free/);
  assert.match(checkout, /decline or the request expires first/);
  assert.match(checkout, /metadata\[candidate_id\]/);
  assert.match(complete, /recordLoveConnectionPurchase/);
  assert.match(access, /never reset an already-consumed credit/);
  assert.match(access, /payment_status === 'paid'/);
  assert.doesNotMatch(access, /payment_status === 'paid' \|\| session\?\.status === 'complete'/);
  assert.match(webhook, /type === 'love_connection'/);
  assert.match(webhook, /product: 'love_connection'/);
  assert.match(lintCleanup, /perform u\.id from public\.love_connection_unlocks/);
  assert.doesNotMatch(lintCleanup, /v_unlock/);
});

test('a paid fourth pick returns as an in-app credit when it never becomes mutual', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260818152000_paid_love_credit_returns.sql', import.meta.url), 'utf8');
  const access = readFileSync(new URL('../lib/love-pick-access.ts', import.meta.url), 'utf8');
  const roster = readFileSync(new URL('../app/dashboard/roster-picker.tsx', import.meta.url), 'utf8');
  const pass = readFileSync(new URL('../app/api/matches/[id]/pass/route.ts', import.meta.url), 'utf8');
  const expiry = readFileSync(new URL('../lib/match-actions.ts', import.meta.url), 'utf8');
  assert.match(migration, /drop constraint if exists love_pick_ledger_unlock_id_key/);
  assert.match(migration, /p_decliner_id = v_ledger\.user_id[\s\S]*return null/);
  assert.match(migration, /set status = 'credit', intended_candidate_id = null, match_id = null/);
  assert.match(migration, /return 'paid'/);
  assert.match(access, /Your Love credit is back/);
  assert.match(access, /Your next extra Love pick is covered in the app/);
  assert.match(roster, /in-app Love credit is ready/);
  assert.match(roster, /match \+ chat with/);
  assert.match(pass, /returnLovePickEntitlement\(id, user\.id\)/);
  assert.match(expiry, /returnLovePickEntitlement\(m\.id, null\)/);
});

test('the isolated admin seed world mirrors the seven-option Love roster', () => {
  const seeder = readFileSync(new URL('../app/api/admin/seed-test/route.ts', import.meta.url), 'utf8');
  const admin = readFileSync(new URL('../app/admin/admin-client.tsx', import.meta.url), 'utf8');
  assert.match(seeder, /seven-option roster carousel/);
  assert.match(seeder, /love_pick_ledger/);
  assert.match(seeder, /love_connection_unlocks/);
  assert.match(admin, /12 test accounts/);
  assert.match(admin, /seven roster options/);
});

test('phone match room separates chat, plan, and profile below the measured PWA nav', () => {
  const room = readFileSync(new URL('../app/match/[id]/chat-room.tsx', import.meta.url), 'utf8');
  const roomCss = readFileSync(new URL('../app/match/[id]/chat.module.css', import.meta.url), 'utf8');
  const nav = readFileSync(new URL('../components/top-nav.tsx', import.meta.url), 'utf8');
  assert.match(room, /'chat' \| 'plan' \| 'profile'/);
  assert.match(room, /data-mobile-panel=\{mobilePanel\}/);
  assert.match(room, /role="tablist"/);
  assert.match(room, /mutual=\{!!\(liveMatch\?\.user_1_accepted/);
  assert.match(room, /plan together after the mutual yes/);
  assert.match(room, /if \(pendingAccept\)/);
  assert.doesNotMatch(room, /Math\.random\(\).*PLACEHOLDERS|PLACEHOLDERS\[Math\.floor/);
  assert.match(roomCss, /var\(--app-top-nav-height/);
  assert.match(roomCss, /data-mobile-panel='plan'/);
  assert.match(roomCss, /data-mobile-panel='profile'/);
  assert.match(nav, /ResizeObserver/);
});

test('ending remains free and safe but does not replenish a user-started roster pick', () => {
  const route = readFileSync(new URL('../app/api/matches/[id]/end/route.ts', import.meta.url), 'utf8');
  const dialog = readFileSync(new URL('../components/end-match-dialog.tsx', import.meta.url), 'utf8');
  assert.match(route, /status: 'ended'/);
  assert.match(route, /status: 'waiting'/);
  assert.match(route, /match_history/);
  assert.match(dialog, /does not replenish a pick you started/);
  assert.match(dialog, /end connection →/);
  assert.match(route, /returnLovePickEntitlement\(matchId, user\.id\)/);
});
