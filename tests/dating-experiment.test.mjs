import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCoverageFirstShortlist,
  assignDinnerSlots,
  mutualSelectionWeight,
  selectMutualDinnerPair,
  selectMutualDinnerPairs,
  selectMutualDinnerPairsForSlots,
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

test('Dating Experiment public launch stays free, local, limited, and payment-neutral', () => {
  assert.match(experimentSource, /series:\s*'The NotCupid Dating Experiment'/);
  assert.match(experimentSource, /entriesOpen:\s*true/);
  assert.match(experimentSource, /cap:\s*400/);
  assert.match(experimentSource, /winnerPairCount:\s*2/);
  assert.match(experimentSource, /termsVersion:\s*'boston-v13-2026-08-15'/);
  assert.match(experimentSource, /aug20-1830/);
  assert.match(experimentSource, /aug20-2030/);
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

test('slot-aware selection preserves two winners and never assigns an unavailable time', () => {
  const edges = [
    { id: 'ab', a: 'a', b: 'b', score: 99, aAccepted: true, bAccepted: true, availableSlotKeys: ['early'] },
    { id: 'ac', a: 'a', b: 'c', score: 95, aAccepted: true, bAccepted: true, availableSlotKeys: ['late'] },
    { id: 'bd', a: 'b', b: 'd', score: 94, aAccepted: true, bAccepted: true, availableSlotKeys: ['early'] },
  ];
  const selected = selectMutualDinnerPairsForSlots(edges, 2, ['early', 'late'], () => 1, () => 0);
  assert.deepEqual(selected.map(({ edge, slotKey }) => [edge.id, slotKey]), [['ac', 'late'], ['bd', 'early']]);
  assert.equal(new Set(selected.map((selection) => selection.slotKey)).size, 2);
  assert.ok(selected.every(({ edge, slotKey }) => edge.availableSlotKeys.includes(slotKey)));
  assert.deepEqual(assignDinnerSlots([edges[1], edges[2]], ['early', 'late'])?.map((item) => item.slotKey), ['late', 'early']);
  assert.equal(assignDinnerSlots([edges[0], edges[2]], ['early', 'late']), null);
});

test('entry requires versioned, separate consent records while video stays optional', () => {
  const source = readFileSync(new URL('../app/api/raffle/enter/route.ts', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../app/raffle/raffle-client.tsx', import.meta.url), 'utf8');
  const terms = readFileSync(new URL('../app/dating-experiment/terms/page.tsx', import.meta.url), 'utf8');
  const uploadSource = readFileSync(new URL('../app/api/raffle/upload-url/route.ts', import.meta.url), 'utf8');
  const eventMigration = readFileSync(new URL('../supabase/migrations/20260808193341_dating_experiment_event_ledger.sql', import.meta.url), 'utf8');
  const optionalVideoMigration = readFileSync(new URL('../supabase/migrations/20260816011500_dating_experiment_optional_video_v12.sql', import.meta.url), 'utf8');
  const statusSource = readFileSync(new URL('../app/api/raffle/status/route.ts', import.meta.url), 'utf8');
  for (const required of [
    'terms_version',
    'terms_accepted_at',
    'video_consent_at',
    'safety_acknowledged_at',
    'attendance_confirmed_at',
  ]) assert.match(eventMigration, new RegExp(required));
  assert.match(optionalVideoMigration, /preview_consent_at/);
  assert.match(source, /p_accepted_at: acceptedAt/);
  assert.match(source, /body\.termsAccepted !== true/);
  assert.match(source, /body\.previewConsent !== true/);
  assert.match(source, /body\.safetyAcknowledged !== true/);
  assert.match(source, /body\.attendanceConfirmed !== true/);
  assert.doesNotMatch(source, /intro video is required to enter/);
  assert.match(optionalVideoMigration, /if p_accepted_at is null or p_questionnaire is null then/i);
  assert.doesNotMatch(optionalVideoMigration, /p_accepted_at is null or p_video_url is null or p_questionnaire/i);
  assert.match(optionalVideoMigration, /case when p_video_url is not null then p_accepted_at else null end/i);
  assert.match(optionalVideoMigration, /terms_version = 'boston-v12-2026-08-15'/i);
  assert.match(client, /const canEnter = credOk && basicsOk && questionsOk && consentOk/);
  assert.doesNotMatch(client, /canEnter =[^;]*!!videoUrl/);
  assert.match(client, /your intro video[\s\S]*· optional/);
  assert.match(terms, /Choosing not to add a video does not affect eligibility, fit score, shortlist priority, or selection odds/);
  assert.match(source, /preferences: \{ gender, orientation, seekingGenders, ageMin, ageMax \}/);
  assert.match(source, /Choose the orientation label that feels closest to you/);
  assert.match(source, /Choose at least one gender you would like to meet/);
  assert.match(source, /Choose a valid age range between 21 and 99/);
  assert.match(source, /Choose at least one dinner time you can attend/);
  assert.match(source, /availableSlotKeys/);
  assert.match(source, /datingExperimentEntriesOpen\(event\)/);
  assert.match(uploadSource, /datingExperimentEntriesOpen\(event\)/);
  assert.match(uploadSource, /export async function DELETE/);
  assert.match(uploadSource, /managedStoragePath\(body\.video_url, 'raffle-videos', `\$\{user\.id\}\/\$\{RAFFLE\.key\}-`\)/);
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

test('the Boston experiment owns two August 20 time slots while venue remains fail-closed', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260815143000_dating_experiment_august_20_slots.sql', import.meta.url), 'utf8');
  const eventSource = readFileSync(new URL('../lib/dating-experiment-event.ts', import.meta.url), 'utf8');
  const terms = readFileSync(new URL('../app/dating-experiment/terms/page.tsx', import.meta.url), 'utf8');
  assert.match(migration, /slot_key text/i);
  assert.match(migration, /primary key \(event_key, slot_key\)/i);
  assert.match(migration, /'2026-08-20'/);
  assert.match(migration, /'2026-08-20T22:30:00Z'/);
  assert.match(migration, /'2026-08-21T00:30:00Z'/);
  assert.match(migration, /terms_version = 'boston-v7-2026-08-15'/i);
  assert.match(migration, /prize_funding_confirmed = true/i);
  assert.match(migration, /venue_confirmed = false/i);
  assert.match(migration, /validate_dating_experiment_slot_availability/i);
  assert.match(migration, /dinner availability contains an unknown slot/i);
  assert.match(eventSource, /date\.status === 'time_confirmed'/);
  assert.match(eventSource, /date\.starts_at != null/);
  assert.match(terms, /Thursday, August 20, 2026/);
  assert.match(terms, /6:30 PM Eastern Time/);
  assert.match(terms, /8:30 PM Eastern Time/);
});

test('public launch approvals are dated, attributable, and required in code and database', () => {
  const legacyMigration = readFileSync(new URL('../supabase/migrations/20260815223000_dating_experiment_launch_signoffs.sql', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/20260816004500_dating_experiment_operator_rehearsal.sql', import.meta.url), 'utf8');
  const eventSource = readFileSync(new URL('../lib/dating-experiment-event.ts', import.meta.url), 'utf8');
  for (const field of [
    'prize_funding_confirmed_at', 'venue_confirmed_at', 'venue_confirmation_reference',
    'prize_fulfillment_method', 'sponsor_details_confirmed_at', 'sponsor_legal_name',
    'sponsor_public_mailing_address',
  ]) {
    assert.match(legacyMigration, new RegExp(field));
    assert.match(eventSource, new RegExp(field));
  }
  for (const field of [
    'operator_compliance_approved', 'operator_compliance_approved_at',
    'operator_compliance_reference',
  ]) {
    assert.match(migration, new RegExp(field));
    assert.match(eventSource, new RegExp(field));
  }
  assert.match(migration, /rename column legal_review_approved to operator_compliance_approved/i);
  assert.match(migration, /status <> 'entry_open'/i);
  assert.match(migration, /terms_version = 'boston-v11-2026-08-15'/i);
  assert.match(migration, /status = 'entry_open'/i);
  assert.match(eventSource, /event\.operator_compliance_approved_at != null/);
  assert.match(eventSource, /event\.sponsor_public_mailing_address\?\.trim\(\)/);
  assert.doesNotMatch(eventSource, /legal_review/);
});

test('V9 adds a transparent event questionnaire, private Berkeley reveal, and opted-in reminders', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260815232000_dating_experiment_berkeley_questionnaire_v9.sql', import.meta.url), 'utf8');
  const entry = readFileSync(new URL('../app/api/raffle/enter/route.ts', import.meta.url), 'utf8');
  const status = readFileSync(new URL('../app/api/raffle/status/route.ts', import.meta.url), 'utf8');
  const draw = readFileSync(new URL('../lib/raffle-draw.ts', import.meta.url), 'utf8');
  const reminders = readFileSync(new URL('../app/api/cron/dating-experiment-reminders/route.ts', import.meta.url), 'utf8');
  const cron = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
  assert.match(migration, /The Berkeley · 154 Berkeley Street, Boston, MA 02116/);
  assert.match(migration, /venue_confirmed = false/i);
  assert.match(migration, /terms_version = 'boston-v9-2026-08-15'/i);
  assert.match(migration, /algorithm_version = 'dating-experiment-two-pair-v4'/i);
  assert.match(migration, /reminder_24h_sent_at/);
  assert.match(migration, /reminder_3h_sent_at/);
  assert.match(entry, /PLANNING_STYLES/);
  assert.match(entry, /planningStyle/);
  assert.match(status, /sharedInterests/);
  assert.match(status, /introVideoPreviewUrl/);
  assert.match(draw, /notify === false/);
  assert.match(draw, /notificationsEnabled\.has\(id\)/);
  assert.match(reminders, /\.eq\('status', 'both_accepted'\)/);
  assert.match(reminders, /\.is\(field, null\)/);
  assert.match(reminders, /entry\.notify !== false/);
  assert.match(cron, /\/api\/cron\/dating-experiment-reminders/);
});

test('experiment terms do not bundle a marketing likeness license', () => {
  const terms = readFileSync(new URL('../app/dating-experiment/terms/page.tsx', import.meta.url), 'utf8');
  assert.match(terms, /requires separate written consent/i);
  assert.doesNotMatch(terms, /royalty-free, worldwide license/i);
});

test('experiment has a current-status FAQ beside the public flow', () => {
  const faq = readFileSync(new URL('../app/dating-experiment/faq/page.tsx', import.meta.url), 'utf8');
  const flow = readFileSync(new URL('../app/raffle/raffle-client.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(faq, /Final rehearsal:/);
  assert.match(faq, /Entries are open:/);
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

test('public entry is open only while every launch prerequisite remains approved', () => {
  const drawSource = readFileSync(new URL('../lib/raffle-draw.ts', import.meta.url), 'utf8');
  const eventSource = readFileSync(new URL('../lib/dating-experiment-event.ts', import.meta.url), 'utf8');
  const pageSource = readFileSync(new URL('../app/dating-experiment/page.tsx', import.meta.url), 'utf8');
  const statusSource = readFileSync(new URL('../app/api/raffle/status/route.ts', import.meta.url), 'utf8');
  const entrySource = readFileSync(new URL('../app/api/raffle/enter/route.ts', import.meta.url), 'utf8');
  const uploadSource = readFileSync(new URL('../app/api/raffle/upload-url/route.ts', import.meta.url), 'utf8');
  assert.match(experimentSource, /prizeFundingConfirmed: true/);
  assert.match(experimentSource, /venueConfirmed: true/);
  assert.match(experimentSource, /sponsorDetailsConfirmed: true/);
  assert.match(experimentSource, /operatorComplianceApproved: true/);
  assert.match(experimentSource, /entriesOpen:\s*true/);
  assert.match(experimentSource, /raffleLaunchBlockers\(\)\.length === 0/);
  assert.match(eventSource, /RAFFLE\.entriesOpen[\s\S]*raffleLaunchBlockers\(\)\.length === 0/);
  assert.match(eventSource, /event\.status === 'entry_open'/);
  assert.match(eventSource, /hasDatabaseLaunchApproval\(event\)/);
  assert.match(eventSource, /DATING_EXPERIMENT_REHEARSAL_EMAILS/);
  assert.match(eventSource, /isAdminEmail\(email\)/);
  assert.match(eventSource, /user\?\.is_test !== true/);
  assert.match(eventSource, /!RAFFLE\.entriesOpen/);
  for (const routeSource of [pageSource, statusSource, entrySource, uploadSource]) {
    assert.match(routeSource, /datingExperimentAdminRehearsalOpen/);
  }
  assert.match(drawSource, /if \(!datingExperimentCanShortlist\(event\)\) return \{ ok: true, entrants: 0, drawn: 0, state: 'paused' \}/);
  assert.doesNotMatch(drawSource, /!datingExperimentCanShortlist\(event\) && !force/);
});

test('V13 records the 400-person public launch without counting stale terms', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260816013000_dating_experiment_public_launch_v13.sql', import.meta.url), 'utf8');
  const statusSource = readFileSync(new URL('../app/api/raffle/status/route.ts', import.meta.url), 'utf8');
  const drawSource = readFileSync(new URL('../lib/raffle-draw.ts', import.meta.url), 'utf8');
  assert.match(migration, /entry_cap = 400/i);
  assert.match(migration, /terms_version = 'boston-v13-2026-08-15'/i);
  assert.match(migration, /status = 'entry_open'/i);
  assert.match(migration, /v_existing_terms_version is distinct from v_event\.terms_version/i);
  assert.match(migration, /terms_version = v_event\.terms_version/i);
  assert.match(statusSource, /\.eq\('terms_version', event\?\.terms_version \?\? RAFFLE\.termsVersion\)/);
  assert.match(drawSource, /\.eq\('terms_version', event\.terms_version\)/);
});

test('Berkeley reservations and direct prepayment are confirmed without opening entries', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260815235500_dating_experiment_confirm_berkeley_fulfillment.sql', import.meta.url), 'utf8');
  assert.match(migration, /venue_confirmed = true/i);
  assert.match(migration, /venue_confirmed_at = now\(\)/i);
  assert.match(migration, /both Berkeley dinner reservations confirmed/i);
  assert.match(migration, /NotCupid prepaid The Berkeley directly/i);
  assert.match(migration, /not required to pay or request reimbursement/i);
  assert.match(migration, /parking, valet charges or tips, transportation/i);
  assert.match(migration, /terms_version = 'boston-v10-2026-08-15'/i);
  assert.match(migration, /status = 'draft'/i);
  assert.doesNotMatch(migration, /sponsor_details_confirmed = true/i);
  assert.doesNotMatch(migration, /legal_review_approved = true/i);
});

test('paid Only in Boston promotion stays off product pages and in the private launch record', () => {
  const terms = readFileSync(new URL('../app/dating-experiment/terms/page.tsx', import.meta.url), 'utf8');
  const faq = readFileSync(new URL('../app/dating-experiment/faq/page.tsx', import.meta.url), 'utf8');
  const checklist = readFileSync(new URL('../docs/dating-experiment-public-launch-checklist-2026-08-15.md', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/20260815235900_dating_experiment_terms_v11.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(terms, /Only in Boston/);
  assert.doesNotMatch(faq, /Only in Boston/);
  assert.match(checklist, /paying Only in Boston \$200/);
  assert.match(checklist, /Ad · NotCupid Dating Experiment/);
  assert.match(checklist, /not on NotCupid's product pages/);
  assert.doesNotMatch(checklist, /Only in Boston relationship\/disclosure:\s*$/m);
  assert.match(migration, /terms_version = 'boston-v11-2026-08-15'/);
  assert.match(migration, /status = 'draft'/);
});
