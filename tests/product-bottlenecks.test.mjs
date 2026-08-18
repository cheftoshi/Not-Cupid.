import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { detectProductBottlenecks } from '../lib/product-bottlenecks.ts';

test('snapshot diagnosis flags the current Love, attribution, notification, and revenue leaks', () => {
  const result = detectProductBottlenecks({
    measuredAt: '2026-08-18T20:06:27.364Z',
    onlyInBoston: {
      campaignActive: true,
      launchWindowSessions: 262,
      launchWindowEntries: 5,
      attributedSessions: 0,
    },
    loveUsage: { last7d: { pickers: 36 } },
    loveFunnel: {
      activePool: 122,
      activePoolWithoutLiveConnection: 84,
      oneSidedConnections: 28,
      unanswered24h: 19,
      unanswered48h: 9,
      mutualConnections: 7,
      mutualWithoutMessage: 3,
      notifications: {
        immediateSent: 0,
        reminder24hSent: 30,
        finalSent: 0,
        mutualNoMessage12hSent: 0,
        delivered: 0,
        failed: 0,
      },
    },
    monetization: { periodDays: 30, paywallViewers: 40, checkoutStarters: 0 },
  });

  const ids = new Set(result.items.map((item) => item.id));
  for (const id of [
    'love-connection-coverage',
    'love-decision-latency',
    'love-mutual-to-message',
    'love-roster-to-pick',
    'notification-observability',
    'campaign-attribution',
    'campaign-visit-to-entry',
    'paywall-to-checkout',
  ]) assert.ok(ids.has(id), `expected ${id}`);
  assert.equal(result.summary.total, result.items.length);
  assert.equal(result.items[0].severity, 'critical');
  assert.match(result.method, /not an automatic product change/i);
});

test('healthy cohorts do not manufacture bottlenecks', () => {
  const result = detectProductBottlenecks({
    onlyInBoston: { campaignActive: true, launchWindowSessions: 100, launchWindowEntries: 8, attributedSessions: 80 },
    loveUsage: { last7d: { pickers: 50 } },
    loveFunnel: {
      activePool: 100,
      activePoolWithoutLiveConnection: 20,
      oneSidedConnections: 20,
      unanswered24h: 2,
      unanswered48h: 0,
      mutualConnections: 20,
      mutualWithoutMessage: 2,
      notifications: { immediateSent: 10, reminder24hSent: 2, finalSent: 0, mutualNoMessage12hSent: 0, delivered: 11, failed: 1 },
    },
    monetization: { periodDays: 30, paywallViewers: 40, checkoutStarters: 5 },
    appExperience: { performance: { rosterApiP75Ms: 800, inpP75Ms: 180, clientErrors: 0 }, interactions: { profileOpens: 30, compatibilityReadRequests: 3 } },
    friend: { optedIn: 100, connectionActionUsers30d: 25 },
  });
  assert.equal(result.summary.total, 0);
  assert.equal(result.topPriority, null);
});

test('closed campaigns remain historical context instead of permanent live bottlenecks', () => {
  const result = detectProductBottlenecks({
    onlyInBoston: { campaignActive: false, launchWindowSessions: 500, launchWindowEntries: 0, attributedSessions: 0 },
  });
  assert.equal(result.items.some((item) => item.area === 'acquisition'), false);
});

test('admin snapshots expose and render the ranked diagnosis', () => {
  const route = readFileSync(new URL('../app/api/admin-stats/route.ts', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../app/admin/admin-client.tsx', import.meta.url), 'utf8');
  assert.match(route, /detectProductBottlenecks/);
  assert.match(route, /bottlenecks,/);
  assert.match(client, /Snapshot diagnosis/);
  assert.match(client, /Nothing here automatically changes matching or contacts a user/);
});
