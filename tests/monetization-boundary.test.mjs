import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Love profiles, acceptance, replies, planning, and safety controls stay free', () => {
  const hub = read('../app/hub/hub-client.tsx');
  const faq = read('../app/faq/page.tsx');
  const how = read('../app/how-it-works/page.tsx');
  const privacy = read('../app/privacy/page.tsx');
  const terms = read('../app/terms/page.tsx');

  assert.match(hub, /Every Love profile is free/);
  assert.match(faq, /The recipient never pays to accept or reply/);
  assert.match(how, /accepting, replying, blocking and reporting never cost anything/);
  assert.match(privacy, /before choosing/);
  assert.match(terms, /Core profiles, accepting, replying, blocking, reporting, and planning are free/);
  for (const source of [hub, faq, how, privacy, terms]) {
    assert.doesNotMatch(source, /unlocking a full match profile|Love profile unlocks|every private profile/i);
  }
});

test('only an outgoing pick after the three included roster picks is paywalled', () => {
  const picker = read('../app/dashboard/roster-picker.tsx');
  const pick = read('../app/api/match/pick/route.ts');
  const migration = read('../supabase/migrations/20260818143000_love_connection_picks.sql');
  assert.match(picker, /includedRemaining <= 0/);
  assert.match(picker, /extra Love connection · one-time \$0\.99/);
  assert.match(pick, /pickAccess\.includedRemaining > 0/);
  assert.match(pick, /paywall: true/);
  assert.match(migration, /recipient never pays/);
  assert.match(migration, /return_included_love_pick/);
});

test('payment routes prevent test charges and duplicate subscriber purchases', () => {
  const love = read('../app/api/match/connection-checkout/route.ts');
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

test('an extra-connection purchase is pair-specific and never charges the recipient', () => {
  const webhook = read('../app/api/stripe-webhook/route.ts');
  const checkout = read('../app/api/match/connection-checkout/route.ts');
  assert.match(checkout, /metadata\[candidate_id\]/);
  assert.match(checkout, /If interest is mutual, chat is included/);
  assert.doesNotMatch(webhook, /Someone unlocked your profile/);
});
