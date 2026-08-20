import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Love profiles, acceptance, replies, planning, and safety controls stay free', () => {
  const roster = read('../app/dashboard/roster-picker.tsx');
  const faq = read('../app/faq/page.tsx');
  const how = read('../app/how-it-works/page.tsx');
  const privacy = read('../app/privacy/page.tsx');
  const terms = read('../app/terms/page.tsx');

  assert.match(roster, /this profile is free/);
  assert.match(faq, /The recipient never pays to accept or reply/);
  assert.match(how, /accepting, replying, blocking and reporting never cost anything/);
  assert.match(privacy, /before choosing/);
  assert.match(terms, /Core profiles, accepting, replying, blocking, reporting, and planning are free/);
  for (const source of [roster, faq, how, privacy, terms]) {
    assert.doesNotMatch(source, /unlocking a full match profile|Love profile unlocks|every private profile/i);
  }
});

test('core profiles stay free while optional AI decision support and extra picks can be paid', () => {
  const picker = read('../app/dashboard/roster-picker.tsx');
  const pick = read('../app/api/match/pick/route.ts');
  const reportRoute = read('../app/api/love/compatibility-read/[candidateId]/route.ts');
  const migration = read('../supabase/migrations/20260818143000_love_connection_picks.sql');
  const creditMigration = read('../supabase/migrations/20260818152000_paid_love_credit_returns.sql');
  assert.match(picker, /includedRemaining <= 0/);
  assert.match(picker, /extra Love connection · one-time \$0\.99/);
  assert.match(picker, /AI \+ HEXACO/);
  assert.match(picker, /Raw answers and exact scores stay private/);
  assert.match(reportRoute, /paywall: true/);
  assert.match(reportRoute, /exact trait scores/);
  assert.match(pick, /pickAccess\.includedRemaining > 0/);
  assert.match(pick, /paywall: true/);
  assert.match(migration, /recipient never pays/);
  assert.match(creditMigration, /return_love_pick_entitlement/);
  assert.match(creditMigration, /access_type in \('included', 'paid'\)/);
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

test('checkout analytics distinguish intent from an actual Stripe handoff', () => {
  const stats = read('../app/api/admin-stats/route.ts');
  const admin = read('../app/admin/admin-client.tsx');
  assert.match(stats, /checkout_clicked/);
  assert.match(stats, /stripe_session_created/);
  assert.match(stats, /row\.product !== 'love_profile'/);
  assert.match(admin, /Checkout clicks/);
  assert.match(admin, /Stripe sessions/);
  assert.match(admin, /Current totals exclude the retired profile-view paywall/);
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
  assert.match(checkout, /If mutual, chat is included/);
  assert.match(checkout, /returns as an in-app credit/);
  assert.doesNotMatch(webhook, /Someone unlocked your profile/);
});

test('a returned connection credit is reusable without forcing another AI-read checkout', () => {
  const picker = read('../app/dashboard/roster-picker.tsx');
  assert.match(picker, /submitPick\(c, hasCredit\)/);
  assert.match(picker, /use returned credit/);
  assert.doesNotMatch(picker, /A returned\/pre-release connection credit also carries the new read/);
});
