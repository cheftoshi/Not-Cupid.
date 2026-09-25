import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialPlanFilter, liveConnectionPlans, planHasEnded } from '../lib/connection-plans.ts';
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('Home button labels use a solid color token, not the gradient background token', () => {
  const css = source('app/hub/plans-home.module.css');
  assert.doesNotMatch(css, /(?:^|[;{])\s*color:\s*var\(--h-bg\)/m);
  assert.match(css, /color: var\(--h-surface\)/);
});
test('Home starts with selected lines without implying romantic intent', () => {
  assert.equal(initialPlanFilter({}), 'friends');
  assert.equal(initialPlanFilter({ friend_opted_in_at: 'yes' }), 'friends');
  assert.equal(initialPlanFilter({ attach_style: 'secure' }), 'dating');
  assert.equal(initialPlanFilter({ attach_style: 'secure', friend_opted_in_at: 'yes' }), 'all');
});
test('Home shows active user plans, dated first, not past events or discussion filler', () => {
  const base = { kind: 'event', created_at: '2026-09-20T00:00:00Z', expires_at: '2026-10-01T00:00:00Z' };
  const plans = [
    { ...base, id: 'flexible' },
    { ...base, id: 'later', happens_at: '2026-09-25T00:00:00Z' },
    { ...base, id: 'soon', happens_at: '2026-09-24T00:00:00Z' },
    { ...base, id: 'past', happens_at: '2026-09-22T00:00:00Z' },
    { ...base, id: 'expired', expires_at: '2026-09-22T00:00:00Z' },
    { ...base, id: 'post', kind: 'post' },
  ];
  assert.deepEqual(liveConnectionPlans(plans, Date.parse('2026-09-23')).map(p => p.id), ['soon','later','flexible']);
  assert.equal(planHasEnded(plans[3], Date.parse('2026-09-23')), true);
});
test('App-wide plans retain atomic capacity, participant chat and reported-host exclusions', () => {
  const rsvp = source('app/api/friend/activities/[id]/rsvp/route.ts');
  const chat = source('app/api/friend/activities/[id]/comments/route.ts');
  const board = source('app/api/friend/activities/route.ts');
  assert.match(rsvp, /rpc\('set_friend_activity_rsvp'/);
  assert.match(rsvp, /planHasEnded\(activity\)/);
  for (const route of [rsvp, chat]) assert.match(route, /friendActivityAuthorAvailable/);
  assert.match(chat, /response\?\.response === 'yes'/);
  assert.match(board, /blocked\.has\(author.id\)/);
  assert.match(board, /kind === 'post' && !user.friend_opted_in_at/);
  assert.doesNotMatch(board, /await ins\(baseRow\)/);
  assert.match(board, /error\?\.code === '23505' && clientId/);
});
test('Plan-first Home does not pull external event listings or mount AI as its first view', () => {
  const page = source('app/hub/page.tsx');
  const home = source('app/hub/plans-home.tsx');
  const controls = source('app/hub/plan-controls.tsx');
  assert.match(page, /params.view !== 'coach'/);
  assert.match(home, /surface=home/);
  assert.doesNotMatch(home, /ticketmaster|eventbrite|boston-calendar|api\/live-events|ConnectionConcierge/);
  assert.match(controls, /Optional details/);
  assert.match(controls, /client_id: retry.current.id/);
});
