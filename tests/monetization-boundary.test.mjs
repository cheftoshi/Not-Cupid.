import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('core Love identity, matching, chat and planning are never described as paid', () => {
  const hub = read('../app/hub/hub-client.tsx');
  const faq = read('../app/faq/page.tsx');
  const how = read('../app/how-it-works/page.tsx');
  const privacy = read('../app/privacy/page.tsx');
  const terms = read('../app/terms/page.tsx');

  assert.match(hub, /Every Love profile is free/);
  assert.match(faq, /Chat and planning stay free/);
  assert.match(how, /complete Love profiles, matching, chat, and planning are <b>free<\/b>/);
  assert.match(privacy, /before choosing/);
  assert.match(terms, /Core profiles, matching, messaging, and planning are free/);
  for (const source of [hub, faq, how, privacy, terms]) {
    assert.doesNotMatch(source, /unlocking a full match profile|Love profile unlocks|every private profile/i);
  }
});

test('paid decision support appears only after a mutual connection', () => {
  const page = read('../app/match/[id]/page.tsx');
  const room = read('../app/match/[id]/chat-room.tsx');
  const checkout = read('../app/api/matches/[id]/unlock-checkout/route.ts');

  assert.match(page, /const mutuallyConnected = !!match\.user_1_accepted && !!match\.user_2_accepted/);
  assert.match(page, /const unlockAvailable = mutuallyConnected && !readOnly/);
  assert.match(room, /!pendingAccept && unlockAvailable/);
  assert.match(checkout, /The compatibility deep-dive opens after you both connect/);
  assert.match(checkout, /This connection has ended/);
});

test('payment routes prevent test charges and duplicate subscriber purchases', () => {
  const love = read('../app/api/matches/[id]/unlock-checkout/route.ts');
  const friend = read('../app/api/friend/checkout/route.ts');
  const pro = read('../app/api/pro/checkout/route.ts');

  for (const source of [love, friend, pro]) {
    assert.match(source, /Payments are disabled for test accounts/);
  }
  assert.match(friend, /isPro\(user\)/);
  assert.match(pro, /Your Pro membership is already active/);
});

test('Love coach uses free profile context without leaking paid deep answers', () => {
  const coach = read('../app/api/matches/[id]/coach/route.ts');
  assert.match(coach, /profileContext: \{ interests: safeInterests, bio:/);
  assert.doesNotMatch(coach, /profileUnlocked|unlockedProfileContext|match_unlocks/);
});

test('a deep-dive purchase remains private from the other person', () => {
  const webhook = read('../app/api/stripe-webhook/route.ts');
  assert.match(webhook, /This purchase stays private/);
  assert.doesNotMatch(webhook, /Someone unlocked your profile/);
});
