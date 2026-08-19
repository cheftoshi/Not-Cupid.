import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('profile-ready reminder is the exact approved short email with a compact legal footer', () => {
  const copy = source('lib/eligible-ready-reminder.ts');
  assert.match(copy, /ELIGIBLE_READY_REMINDER_SUBJECT = 'Your profile is ready'/);
  assert.match(copy, /Your NotCupid profile is ready\./);
  assert.match(copy, /wanted to invite you to participate—if you choose\./);
  assert.match(copy, /JOIN THE EXPERIMENT →/);
  assert.match(copy, /No purchase necessary\. Entry, matching, and dinner selection aren’t guaranteed\./);
  assert.match(copy, /NotCupid · operated by Lemon Labs ·/);
  assert.doesNotMatch(copy, /instagram\.com|tiktok\.com|x\.com/);
});

test('reminder audience is narrow, realm-safe, and excludes entered and push-reachable users', () => {
  const audience = source('lib/eligible-ready-audience.ts');
  assert.match(audience, /user\.is_test !== true/);
  assert.match(audience, /!entered\.has\(user\.id\)/);
  assert.match(audience, /experimentProfileReadiness\(user\)\.complete/);
  assert.match(audience, /originalByUser\.get\(user\.id\)\?\.variant === 'profile'/);
  assert.match(audience, /!originalByUser\.has\(user\.id\)/);
  assert.match(audience, /!pushReachable\.has\(user\.id\)/);
  assert.match(audience, /!completed\.has\(user\.id\)/);
});

test('production delivery needs an explicit count-bound send approval and defaults to dry-run', () => {
  const route = source('app/api/admin/send-eligible-ready-reminder/route.ts');
  assert.match(route, /sendRequested = url\.searchParams\.get\('send'\) === '1'/);
  assert.match(route, /ELIGIBLE_READY_EMAIL_APPROVAL_VERSION/);
  assert.match(route, /ELIGIBLE_READY_EMAIL_SEND_APPROVAL_VERSION/);
  assert.match(route, /approvalRecipientCount = audience\.candidates\.length \+ audience\.alreadyCompleted/);
  assert.match(route, /expectedSendApproval = `\$\{ELIGIBLE_READY_REMINDER_APPROVAL_VERSION\}:\$\{approvalRecipientCount\}`/);
  assert.match(route, /if \(!sendRequested\) return NextResponse\.json/);
  assert.match(route, /deliveryAttempted: false/);
});

test('reminder CTA and provider events are tracked under the dedicated campaign key', () => {
  const click = source('app/api/campaign/eligible-ready-reminder/route.ts');
  const inbound = source('app/api/inbound/route.ts');
  const funnel = source('lib/dating-experiment-funnel.ts');
  assert.match(click, /ELIGIBLE_READY_REMINDER_CAMPAIGN/);
  assert.match(click, /event: 'email_clicked'/);
  assert.match(inbound, /trackedCampaigns = new Set\(\[LOVE_RELAUNCH_CAMPAIGN, ELIGIBLE_READY_REMINDER_CAMPAIGN\]\)/);
  assert.match(funnel, /\.in\('campaign_key', \[LOVE_RELAUNCH_CAMPAIGN, ELIGIBLE_READY_REMINDER_CAMPAIGN\]\)/);
});

test('last-chance send uses the approved exact copy and fails closed outside the three-person cohort', () => {
  const copy = source('lib/eligible-ready-reminder.ts');
  const route = source('app/api/admin/send-experiment-last-chance/route.ts');
  const admin = source('app/admin/admin-client.tsx');
  assert.match(copy, /EXPERIMENT_LAST_CHANCE_SUBJECT = 'Your profile is ready — entries close tonight'/);
  assert.match(copy, /Entries for the Boston Dating Experiment close tonight at 11:59 PM ET\./);
  assert.match(copy, /JOIN BEFORE 11:59 PM →/);
  assert.match(copy, /EXPERIMENT_LAST_CHANCE_EXPECTED_RECIPIENTS = 3/);
  assert.match(route, /audience\.candidates\.length !== EXPERIMENT_LAST_CHANCE_EXPECTED_RECIPIENTS/);
  assert.match(route, /body\.approvalVersion === EXPERIMENT_LAST_CHANCE_APPROVAL_VERSION/);
  assert.match(route, /body\.recipientCount === EXPERIMENT_LAST_CHANCE_EXPECTED_RECIPIENTS/);
  assert.match(route, /activity_digest_deliveries/);
  assert.match(route, /dating-experiment-last-chance-v1-2026-08-18-/);
  assert.match(admin, /Send approved last-chance 3/);
});
