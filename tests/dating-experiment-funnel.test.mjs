import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { experimentProfileReadiness } from '../lib/experiment-profile.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const readyProfile = {
  age: 29,
  photo_url: 'https://example.com/photo.jpg',
  archetype: 'grounded-optimist',
  score_honesty: 72,
  bio: 'I know the best dumpling spot.',
  hobbies: ['running'],
  music: ['jazz'],
  food: ['dumplings'],
  sports: [],
};

test('Dating Experiment profile eligibility has one shared, free gate', () => {
  assert.equal(experimentProfileReadiness(readyProfile).complete, true);
  assert.equal(experimentProfileReadiness({ ...readyProfile, bio: '' }).complete, false);
  assert.deepEqual(experimentProfileReadiness({ ...readyProfile, bio: '' }).missing.map((item) => item.key), ['bio']);
  assert.equal(experimentProfileReadiness({ ...readyProfile, intro_video_url: null, gallery: [], prompts: [] }).complete, true);
});

test('campaign profile completion hands eligible people directly into the Experiment', () => {
  const destinations = source('lib/love-relaunch.ts');
  const profilePage = source('app/dating-experiment/profile/page.tsx');
  const profileForm = source('app/dating-experiment/profile/experiment-profile-completion.tsx');
  const profileApi = source('app/api/profile/route.ts');
  assert.match(destinations, /profile: '\/dating-experiment\/profile\?from=dating-experiment-comeback'/);
  assert.match(profilePage, /experimentProfileReadiness\(user\)/);
  assert.match(profilePage, /redirect\('\/dating-experiment\?from=profile-ready'\)/);
  assert.match(profileForm, /event: 'profile_started'/);
  assert.match(profileForm, /X-NotCupid-Funnel/);
  assert.match(profileForm, /\/dating-experiment\?from=profile-complete/);
  assert.match(profileForm, /only add what/);
  assert.match(profileApi, /recordDatingExperimentFunnelEvent\(user\.id, 'profile_saved'/);
  assert.match(profileApi, /recordDatingExperimentFunnelEvent\(user\.id, 'profile_eligible'/);
});

test('campaign funnel ledger is private, idempotent, backfilled, and visible as aggregate admin stages', () => {
  const migration = source('supabase/migrations/20260816130000_campaign_funnel_events.sql');
  const funnel = source('lib/dating-experiment-funnel.ts');
  const click = source('app/api/campaign/love-return/route.ts');
  const experiment = source('app/raffle/raffle-client.tsx');
  const entry = source('app/api/raffle/enter/route.ts');
  const stats = source('app/api/admin-stats/route.ts');
  const admin = source('app/admin/admin-client.tsx');
  const stepMigration = source('supabase/migrations/20260816140000_campaign_funnel_step_events.sql');
  assert.match(migration, /unique \(campaign_key, user_id, event\)/i);
  assert.match(migration, /revoke all on table public\.campaign_funnel_events from public, anon, authenticated/i);
  assert.match(migration, /delivery-ledger-backfill/);
  assert.match(migration, /current-readiness-backfill/);
  assert.match(funnel, /ignoreDuplicates: true/);
  assert.match(click, /recordDatingExperimentFunnelEvent\(userId, 'email_clicked'\)/);
  assert.match(experiment, /trackExperimentFunnel\('experiment_viewed'\)/);
  assert.match(entry, /recordDatingExperimentFunnelEvent\(user\.id, 'entry_submitted'/);
  assert.match(stepMigration, /preferences_completed/);
  assert.match(experiment, /entry_submit_attempted/);
  assert.match(experiment, /entry_submit_failed/);
  assert.match(stats, /profileClickToEligiblePct/);
  assert.match(admin, /Recipient conversion funnel/);
  assert.match(admin, /Submit failed/);
  assert.match(admin, /Entries from campaign/);
});
