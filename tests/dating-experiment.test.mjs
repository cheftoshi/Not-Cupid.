import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCoverageFirstShortlist,
  mutualSelectionWeight,
  selectMutualDinnerPair,
  selectMutualDinnerPairs,
} from '../lib/experiment-shortlist.ts';
import {
  EXPERIMENT_ORIENTATION_OPTIONS,
  experimentGendersFromLegacy,
  experimentOrientationLabel,
  normalizeExperimentOrientation,
  reciprocalExperimentAgeMatch,
  reciprocalExperimentGenderMatch,
  resolveExperimentPreferences,
} from '../lib/experiment-preferences.ts';

const experimentSource = readFileSync(new URL('../lib/raffle.ts', import.meta.url), 'utf8');

test('Dating Experiment stays quiet, free, local, and payment-neutral', () => {
  assert.match(experimentSource, /series:\s*'The NotCupid Dating Experiment'/);
  assert.match(experimentSource, /entriesOpen:\s*false/);
  assert.match(experimentSource, /winnerPairCount:\s*2/);
  assert.match(experimentSource, /termsVersion:\s*'boston-v6-2026-08-08'/);
  assert.match(experimentSource, /2026-08-19/);
  assert.match(experimentSource, /2026-08-21/);
  assert.match(experimentSource, /centerZip:\s*'02116'/);
  assert.match(experimentSource, /radiusMiles:\s*20/);
  assert.doesNotMatch(experimentSource, /proEntries/);
  assert.match(experimentSource, /distance\s*<=\s*location\.radiusMiles/);
});

test('selection weight is bounded and compatibility score remains normalized', () => {
  assert.match(experimentSource, /minimumPairScore:\s*55/);
  assert.match(experimentSource, /Math\.min\(3,/);
  assert.match(experimentSource, /Math\.max\(0,\s*Math\.min\(100,/);
  assert.match(experimentSource, /base\s*\*\s*0\.75\s*\+\s*sharedScore\s*\*\s*0\.15\s*\+\s*answerScore\s*\*\s*0\.10/);
});

test('experiment gender preferences support every one-or-more combination reciprocally', () => {
  assert.deepEqual(experimentGendersFromLegacy('both'), ['m', 'f', 'nb']);
  const woman = { gender: 'f', seeking_genders: ['m', 'nb'] };
  const nonbinary = { gender: 'nb', seeking_genders: ['f'] };
  const man = { gender: 'm', seeking_genders: ['f'] };
  assert.equal(reciprocalExperimentGenderMatch(woman, nonbinary), true);
  assert.equal(reciprocalExperimentGenderMatch(woman, man), true);
  assert.equal(reciprocalExperimentGenderMatch(nonbinary, man), false);
  assert.equal(reciprocalExperimentGenderMatch(
    { gender: 'f', seeking_genders: ['nb'] },
    { gender: 'nb', seeking_genders: ['m'] },
  ), false);
});

test('bisexual is a first-class orientation while gender selections remain authoritative', () => {
  assert.ok(EXPERIMENT_ORIENTATION_OPTIONS.some((option) => option.value === 'bisexual' && option.label === 'bisexual'));
  assert.equal(normalizeExperimentOrientation('bisexual'), 'bisexual');
  assert.equal(experimentOrientationLabel('bisexual'), 'bisexual');
  assert.equal(experimentOrientationLabel('unlabeled'), null);
  assert.equal(normalizeExperimentOrientation('not-a-real-option'), null);
});

test('experiment age preferences are inclusive and must work both ways', () => {
  const a = { age: 30, age_min: 25, age_max: 35 };
  assert.equal(reciprocalExperimentAgeMatch(a, { age: 35, age_min: 30, age_max: 40 }), true);
  assert.equal(reciprocalExperimentAgeMatch(a, { age: 36, age_min: 30, age_max: 40 }), false);
  assert.equal(reciprocalExperimentAgeMatch(a, { age: 35, age_min: 31, age_max: 40 }), false);
  assert.equal(reciprocalExperimentAgeMatch(a, { age: 35, age_min: 40, age_max: 30 }), false);
  assert.equal(reciprocalExperimentAgeMatch(
    { age: 30, age_min: 18, age_max: 35 },
    { age: 35, age_min: 21, age_max: 40 },
  ), false);
});

test('entry-time preference snapshots override later profile edits', () => {
  const snapshot = resolveExperimentPreferences(
    { gender: 'm', seeking: 'f', age_min: 18, age_max: 99 },
    { preferences: { gender: 'nb', orientation: 'bisexual', seekingGenders: ['f', 'nb'], ageMin: 27, ageMax: 39 } },
  );
  assert.deepEqual(snapshot, {
    gender: 'nb',
    orientation: 'bisexual',
    seekingGenders: ['f', 'nb'],
    ageMin: 27,
    ageMax: 39,
  });
});

test('V2 shortlist prioritizes coverage and never gives anyone more than two options', () => {
  const user = (id) => ({ id });
  const edges = [
    { a: user('a'), b: user('b'), score: 100 },
    { a: user('a'), b: user('c'), score: 99 },
    { a: user('a'), b: user('d'), score: 98 },
    { a: user('b'), b: user('e'), score: 97 },
    { a: user('c'), b: user('f'), score: 96 },
  ];
  const selected = buildCoverageFirstShortlist(edges, 2);
  const counts = new Map();
  for (const edge of selected) {
    counts.set(edge.a.id, (counts.get(edge.a.id) || 0) + 1);
    counts.set(edge.b.id, (counts.get(edge.b.id) || 0) + 1);
  }
  assert.deepEqual([...counts.keys()].sort(), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.ok([...counts.values()].every((count) => count <= 2));
});

test('V2 dinner selection uses only mutual yes pairs and bounded favorite boosts', () => {
  const edges = [
    { id: 'no', a: 'a', b: 'b', score: 90, aAccepted: true, bAccepted: false },
    { id: 'mutual', a: 'c', b: 'd', score: 70, aAccepted: true, bAccepted: true, aFavorite: true, bFavorite: true },
  ];
  assert.equal(selectMutualDinnerPair(edges, () => 1, () => 0)?.id, 'mutual');
  assert.equal(mutualSelectionWeight(edges[1], () => 2), 3);
});

test('V3 selects up to two mutual dinner pairs without reusing a participant', () => {
  const edges = [
    { id: 'ab', a: 'a', b: 'b', score: 90, aAccepted: true, bAccepted: true },
    { id: 'ac', a: 'a', b: 'c', score: 89, aAccepted: true, bAccepted: true },
    { id: 'cd', a: 'c', b: 'd', score: 88, aAccepted: true, bAccepted: true },
    { id: 'no', a: 'e', b: 'f', score: 100, aAccepted: true, bAccepted: false },
  ];
  const selected = selectMutualDinnerPairs(edges, 2, () => 1, () => 0);
  assert.deepEqual(selected.map((edge) => edge.id), ['ab', 'cd']);
  assert.equal(new Set(selected.flatMap((edge) => [edge.a, edge.b])).size, 4);
});

test('V3 preserves a two-pair outcome when a valid disjoint configuration exists', () => {
  const edges = [
    { id: 'blocking', a: 'a', b: 'b', score: 100, aAccepted: true, bAccepted: true },
    { id: 'left', a: 'a', b: 'c', score: 80, aAccepted: true, bAccepted: true },
    { id: 'right', a: 'b', b: 'd', score: 80, aAccepted: true, bAccepted: true },
  ];
  const selected = selectMutualDinnerPairs(edges, 2, () => 1, () => 0);
  assert.deepEqual(selected.map((edge) => edge.id), ['left', 'right']);
});

test('entry requires versioned, separate consent records', () => {
  const source = readFileSync(new URL('../app/api/raffle/enter/route.ts', import.meta.url), 'utf8');
  const eventMigration = readFileSync(new URL('../supabase/migrations/20260808193341_dating_experiment_event_ledger.sql', import.meta.url), 'utf8');
  const statusSource = readFileSync(new URL('../app/api/raffle/status/route.ts', import.meta.url), 'utf8');
  for (const required of [
    'terms_version',
    'terms_accepted_at',
    'video_consent_at',
    'safety_acknowledged_at',
    'attendance_confirmed_at',
  ]) assert.match(eventMigration, new RegExp(required));
  assert.match(source, /p_accepted_at: acceptedAt/);
  assert.match(source, /body\.termsAccepted !== true/);
  assert.match(source, /body\.videoConsent !== true/);
  assert.match(source, /body\.safetyAcknowledged !== true/);
  assert.match(source, /body\.attendanceConfirmed !== true/);
  assert.match(source, /preferences: \{ gender, orientation, seekingGenders, ageMin, ageMax \}/);
  assert.match(source, /Choose the orientation label that feels closest to you/);
  assert.match(source, /Choose at least one gender you would like to meet/);
  assert.match(source, /Choose a valid age range between 21 and 99/);
  assert.doesNotMatch(source, /profilePatch/);
  assert.match(statusSource, /ownEntry\.terms_version === RAFFLE\.termsVersion/);
  assert.match(statusSource, /needs-preference-refresh/);
  assert.match(statusSource, /experimentOrientationLabel/);
});

test('every experiment has an isolated ledger and atomic limited entry transaction', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260808193341_dating_experiment_event_ledger.sql', import.meta.url), 'utf8');
  const entryRoute = readFileSync(new URL('../app/api/raffle/enter/route.ts', import.meta.url), 'utf8');
  assert.match(migration, /create table public\.dating_experiment_events/i);
  assert.match(migration, /entry_cap integer[\s\S]*between 2 and 1000/i);
  assert.match(migration, /shortlist_max_options integer[\s\S]*between 1 and 2/i);
  assert.match(migration, /winner_pair_limit integer[\s\S]*between 1 and 2/i);
  assert.match(migration, /entry_price_cents integer[\s\S]*entry_price_cents = 0/i);
  assert.match(migration, /selection_payment_neutral boolean[\s\S]*is true/i);
  assert.match(migration, /minimum_pair_score integer[\s\S]*between 0 and 100/i);
  assert.match(migration, /winner_fulfillment_details text/i);
  assert.match(migration, /foreign key \(event_key\) references public\.dating_experiment_events\(event_key\)/i);
  assert.match(migration, /create or replace function public\.reserve_dating_experiment_entry/i);
  assert.match(migration, /from public\.dating_experiment_events[\s\S]*for update/i);
  assert.match(migration, /dating experiment entry capacity reached/i);
  assert.match(migration, /revoke all on function public\.reserve_dating_experiment_entry[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /where existing\.event_key = new\.event_key/i);
  assert.match(migration, /new\.winner_slot > v_winner_limit/i);
  assert.match(entryRoute, /rpc\([\s\S]*reserve_dating_experiment_entry/i);
  assert.doesNotMatch(entryRoute, /\.from\('raffle_entries'\)\.upsert/);
});

test('the Boston experiment owns two dates while time and venue remain fail-closed', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260808195154_dating_experiment_event_dates.sql', import.meta.url), 'utf8');
  const eventSource = readFileSync(new URL('../lib/dating-experiment-event.ts', import.meta.url), 'utf8');
  const terms = readFileSync(new URL('../app/dating-experiment/terms/page.tsx', import.meta.url), 'utf8');
  assert.match(migration, /create table public\.dating_experiment_event_dates/i);
  assert.match(migration, /'2026-08-19'/);
  assert.match(migration, /'2026-08-21'/);
  assert.match(migration, /winner_fulfillment_details = null/i);
  assert.match(migration, /terms_version = 'boston-v6-2026-08-08'/i);
  assert.match(eventSource, /date\.status === 'details_confirmed'/);
  assert.match(eventSource, /date\.starts_at != null/);
  assert.match(eventSource, /date\.venue_details != null/);
  assert.match(terms, /August 19 and August 21, 2026/);
  assert.match(terms, /Exact times, restaurant details, and final pair-to-date assignments will be confirmed later/);
});

test('experiment terms do not bundle a marketing likeness license', () => {
  const terms = readFileSync(new URL('../app/dating-experiment/terms/page.tsx', import.meta.url), 'utf8');
  assert.match(terms, /requires separate written consent/i);
  assert.doesNotMatch(terms, /royalty-free, worldwide license/i);
});

test('experiment has a quiet-mode FAQ beside the public flow', () => {
  const faq = readFileSync(new URL('../app/dating-experiment/faq/page.tsx', import.meta.url), 'utf8');
  const flow = readFileSync(new URL('../app/raffle/raffle-client.tsx', import.meta.url), 'utf8');
  assert.match(faq, /Quiet mode:/);
  assert.match(faq, /Paying for Pro[\s\S]*never adds entries or improves selection odds/);
  assert.match(faq, /short-lived links/);
  assert.match(flow, /\/dating-experiment\/faq/);
  assert.match(faq, /same cap of up to/);
  assert.match(faq, /maximum aggregate prize value/);
  assert.match(faq, /saved with your experiment entry/);
  assert.match(faq, /Bisexual is a first-class orientation choice/);
  assert.match(flow, /EXPERIMENT_ORIENTATION_OPTIONS/);
  assert.match(flow, /profile, orientation, photos, answers/);
  assert.match(flow, /choose one or more/);
  assert.match(flow, /No purchase necessary/);
});

test('V2 decisions stay service-only and test accounts are rejected by the database', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260808163959_dating_experiment_mutual_shortlist_v2.sql', import.meta.url), 'utf8');
  const sealingMigration = readFileSync(new URL('../supabase/migrations/20260808165229_seal_dating_experiment_shortlist_choices.sql', import.meta.url), 'utf8');
  const responseRoute = readFileSync(new URL('../app/api/raffle/respond/route.ts', import.meta.url), 'utf8');
  assert.match(migration, /revoke all on table public\.dating_experiment_shortlist_pairs from anon, authenticated/i);
  assert.match(migration, /test accounts cannot enter live dating experiment shortlists/i);
  assert.match(migration, /where status in \('collecting', 'resolving'\)/i);
  assert.match(sealingMigration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sealingMigration, /revoke all on function public\.submit_dating_experiment_shortlist_choices[\s\S]*from public, anon, authenticated/i);
  assert.match(sealingMigration, /for update/i);
  assert.match(responseRoute, /rpc\([\s\S]*submit_dating_experiment_shortlist_choices/i);
});

test('V3 database guardrails enforce two disjoint winner slots', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260808170515_dating_experiment_two_winning_pairs.sql', import.meta.url), 'utf8');
  assert.match(migration, /winner_slot is null or winner_slot between 1 and 2/i);
  assert.match(migration, /participant cannot win twice/i);
  assert.match(migration, /limited to two winning pairs/i);
  assert.match(migration, /revoke all on function public\.enforce_dating_experiment_winner_capacity[\s\S]*from public, anon, authenticated/i);
});

test('public entry remains fail-closed until every launch prerequisite is approved', () => {
  const drawSource = readFileSync(new URL('../lib/raffle-draw.ts', import.meta.url), 'utf8');
  const eventSource = readFileSync(new URL('../lib/dating-experiment-event.ts', import.meta.url), 'utf8');
  for (const gate of ['prizeFundingConfirmed: false', 'venueConfirmed: false', 'sponsorDetailsConfirmed: false', 'legalReviewApproved: false']) {
    assert.match(experimentSource, new RegExp(gate));
  }
  assert.match(experimentSource, /raffleLaunchBlockers\(\)\.length === 0/);
  assert.match(eventSource, /RAFFLE\.entriesOpen[\s\S]*raffleLaunchBlockers\(\)\.length === 0/);
  assert.match(eventSource, /event\.status === 'entry_open'/);
  assert.match(eventSource, /hasDatabaseLaunchApproval\(event\)/);
  assert.match(drawSource, /if \(!datingExperimentCanShortlist\(event\)\) return \{ ok: true, entrants: 0, drawn: 0, state: 'paused' \}/);
  assert.doesNotMatch(drawSource, /!datingExperimentCanShortlist\(event\) && !force/);
});
