import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attributionFromTouch, ONLY_IN_BOSTON_CAMPAIGN, ONLY_IN_BOSTON_FACEBOOK_CAMPAIGN, sanitizeAcquisition } from '../lib/acquisition.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Only in Boston has one stable tagged acquisition route and launch baseline', () => {
  assert.equal(ONLY_IN_BOSTON_CAMPAIGN.shortPath, '/go/only-in-boston');
  assert.equal(ONLY_IN_BOSTON_CAMPAIGN.landingPath, '/dating-experiment');
  assert.equal(ONLY_IN_BOSTON_CAMPAIGN.campaign, 'only_in_boston_aug_2026');
  assert.equal(ONLY_IN_BOSTON_CAMPAIGN.launchStartedAt, '2026-08-18T12:00:00.000Z');
  const redirect = source('app/go/only-in-boston/route.ts');
  assert.match(redirect, /utm_source/);
  assert.match(redirect, /utm_medium/);
  assert.match(redirect, /utm_campaign/);
});

test('Only in Boston Facebook story has a separate clean link and medium', () => {
  assert.equal(ONLY_IN_BOSTON_FACEBOOK_CAMPAIGN.shortPath, '/go/only-in-boston-facebook');
  assert.equal(ONLY_IN_BOSTON_FACEBOOK_CAMPAIGN.medium, 'facebook_story');
  assert.equal(ONLY_IN_BOSTON_FACEBOOK_CAMPAIGN.campaign, ONLY_IN_BOSTON_CAMPAIGN.campaign);
  const redirect = source('app/go/only-in-boston-facebook/route.ts');
  assert.match(redirect, /ONLY_IN_BOSTON_FACEBOOK_CAMPAIGN/);
  assert.match(redirect, /utm_medium/);
});

test('campaign tags are sanitized and social referrers remain non-specific', () => {
  const tagged = attributionFromTouch({
    search: '?utm_source=Only%20In%20Boston&utm_medium=Instagram%20Story&utm_campaign=Boston%20Launch!',
    pathname: '/dating-experiment',
    capturedAt: '2026-08-18T12:30:00.000Z',
  });
  assert.deepEqual(tagged, {
    source: 'only_in_boston',
    medium: 'instagram_story',
    campaign: 'boston_launch',
    kind: 'utm',
    landingPath: '/dating-experiment',
    capturedAt: '2026-08-18T12:30:00.000Z',
  });
  const referral = attributionFromTouch({
    search: '', pathname: '/dating-experiment', referrer: 'https://l.instagram.com/', capturedAt: '2026-08-18T12:30:00.000Z',
  });
  assert.equal(referral?.source, 'instagram');
  assert.equal(referral?.campaign, null);
  assert.equal(referral?.kind, 'referrer');
  assert.equal(sanitizeAcquisition({ source: '!!!' }), null);
});

test('attribution is privacy-minimal and reaches visits, signup, entries, and admin aggregates', () => {
  const tracker = source('components/page-tracker.tsx');
  const trackRoute = source('app/api/track/route.ts');
  const quiz = source('app/quiz/page.tsx');
  const submit = source('app/api/submit/route.ts');
  const experiment = source('app/raffle/raffle-client.tsx');
  const entry = source('app/api/raffle/enter/route.ts');
  const adminRoute = source('app/api/admin-stats/route.ts');
  const admin = source('app/admin/admin-client.tsx');
  const migration = source('supabase/migrations/20260818131500_acquisition_attribution.sql');

  assert.match(tracker, /captureBrowserAcquisition/);
  assert.match(trackRoute, /acquisitionColumns\(sanitizeAcquisition\(acquisition\)\)/);
  assert.match(quiz, /acquisition: readStoredAcquisition\(\)/);
  assert.match(submit, /acquisitionColumns\(sanitizeAcquisition\(body\.acquisition\)\)/);
  assert.match(experiment, /acquisition: readStoredAcquisition\(\)/);
  assert.match(entry, /dating experiment attribution update failed/);
  assert.match(adminRoute, /attributedVisitToEntryPct/);
  assert.match(adminRoute, /instagramReferralSessions/);
  assert.match(adminRoute, /facebookReferralSessions/);
  assert.match(adminRoute, /facebookStory: taggedChannel/);
  assert.match(admin, /Tagged entries/);
  assert.match(admin, /Facebook story — direct attribution/);
  assert.match(admin, /directional and may include other traffic/);
  assert.match(migration, /raw URLs, query strings, user agents and device identifiers are\n-- never stored/);
  assert.match(migration, /alter table public\.page_views/);
  assert.match(migration, /alter table public\.users/);
  assert.match(migration, /alter table public\.raffle_entries/);
});
