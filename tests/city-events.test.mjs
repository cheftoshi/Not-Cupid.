import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, nextMock } from './helpers/load-ts.mjs';
import { normalizeCityEvent, eventInWindow, ticketmasterUrl, eventPrice } from '../lib/city-events.ts';
const now = Date.parse('2026-10-02T17:00:00Z');
const raw = () => ({ id: 'event_1', name: 'Local music', url: 'https://www.ticketmaster.com/event/1',
  dates: { status: { code: 'onsale' }, start: { dateTime: '2026-10-03T23:00:00Z' } },
  classifications: [{ segment: { name: 'Music' } }], _embedded: { venues: [{ name: 'Public theater' }] } });
test('outside event policy excludes unavailable, unknown-time, stale and unsafe links', () => {
  const event = normalizeCityEvent(raw(), now);
  assert.equal(event.id, 'live:tm:event_1');
  assert.equal(eventPrice(event), 'Check ticket price');
  for (const code of ['cancelled', 'postponed', 'rescheduled', 'offsale', undefined]) {
    const r = raw(); r.dates.status.code = code; assert.equal(normalizeCityEvent(r, now), null);
  }
  for (const url of ['javascript:alert(1)', 'https://ticketmaster.com.evil.test/a', 'https://x@ticketmaster.com/a', 'http://ticketmaster.com/a'])
    assert.equal(ticketmasterUrl(url), null);
  const tba = raw(); tba.dates.start.timeTBA = true; assert.equal(normalizeCityEvent(tba, now), null);
  assert.equal(normalizeCityEvent(raw(), Date.parse('2026-10-04')), null);
});
test('weekend is Friday through Sunday in Eastern time, including DST weekends', () => {
  const e = normalizeCityEvent(raw(), now);
  assert.equal(eventInWindow(e, 'weekend', now), true);
  assert.equal(eventInWindow(e, 'today', now), false);
  assert.equal(eventInWindow({ ...e, startsAt: '2026-10-05T03:30:00Z' }, 'weekend', now), true);
  assert.equal(eventInWindow({ ...e, startsAt: '2026-10-05T04:30:00Z' }, 'weekend', now), false);
  assert.equal(eventInWindow({ ...e, startsAt: '2026-11-02T04:30:00Z' }, 'weekend', Date.parse('2026-10-30T17:00:00Z')), true);
  assert.equal(eventInWindow({ ...e, startsAt: '2026-10-09T19:00:00Z' }, 'weekend', Date.parse('2026-10-05T17:00:00Z')), true);
});
test('roundup previews are bounded, escaped, deduplicated and never send-ready', async () => {
  const escapeHtml = x => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const policy = { eventInWindow, eventPrice, ticketmasterUrl };
  const { fridayRoundup } = await loadTs('lib/friday-digest.ts', {
    '@/lib/email': { escapeHtml }, '@/lib/city-events': policy, '@/lib/plan-discovery': { planWhen: s => s },
  });
  const e = { ...normalizeCityEvent(raw(), now), title: '<script>alert(1)</script>' };
  const preview = fridayRoundup('Boston', [e, e, ...[2, 3, 4].map(n => ({ ...e, id: String(n) }))], now);
  assert.equal(preview.events.length, 3); assert.equal(preview.authorizedRecipients, 0);
  assert.equal(preview.enabled, false); assert.equal(preview.sendReady, false);
  assert.equal(preview.html.includes('<script>'), false);
  assert.equal(fridayRoundup('Boston', [], now).wouldSkip, true);
});
test('event API is authenticated, rate limited and uses saved discovery city, never arbitrary input', async () => {
  let user = null, allowed = true, reads = 0;
  const { GET } = await loadTs('app/api/friend/events/route.ts', {
    'next/server': nextMock, '@/lib/auth': { getCurrentUser: async () => user },
    '@/lib/friend-location': { friendLocationContext: async () => ({ metro: 'providence' }) },
    '@/lib/city-events-server': { cityEvents: async metro => { reads++; assert.equal(metro, 'providence'); return { status: 'ready', events: [] }; } },
    '@/lib/rate-limit': { rateLimit: async () => ({ ok: allowed }) },
  });
  assert.equal((await GET()).status, 401); assert.equal(reads, 0);
  user = { id: 'test' }; allowed = false; assert.equal((await GET()).status, 429); assert.equal(reads, 0);
  allowed = true; const response = await GET(); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(reads, 1);
});
test('provider rejects credentials clearly, caches public listings, and always rechecks moderation', async () => {
  const originalFetch = globalThis.fetch, originalKey = process.env.TICKETMASTER_API_KEY;
  process.env.TICKETMASTER_API_KEY = 'synthetic-test-only';
  let status = 401, requests = 0, hidden = [], dbError = null;
  globalThis.fetch = async url => {
    requests++; const u = new URL(url);
    assert.equal(u.searchParams.get('latlong'), '42,-71');
    const r = raw(); r.dates.start.dateTime = new Date(Date.now() + 86400000).toISOString();
    return new Response(JSON.stringify({ _embedded: { events: [r] } }), { status, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const { cityEvents } = await loadTs('lib/city-events-server.ts', {
      '@/lib/quiz-data': { METRO_CENTERS: { boston: { lat: 42, lng: -71 } } },
      '@/lib/city-events': { normalizeCityEvent },
      '@/lib/supabase': { supabaseAdmin: { from: () => ({ select: async () => ({ data: hidden, error: dbError }) }) } },
    });
    assert.equal((await cityEvents('boston')).status, 'credentials_rejected');
    status = 200; assert.equal((await cityEvents('boston')).events.length, 1);
    assert.equal(requests, 2);
    hidden = [{ activity_id: 'live:tm:event_1' }];
    assert.equal((await cityEvents('boston')).events.length, 0); assert.equal(requests, 2);
    hidden = []; dbError = { message: 'unavailable' };
    assert.equal((await cityEvents('boston')).status, 'unavailable');
    dbError = null; await cityEvents('boston', true); assert.equal(requests, 3);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TICKETMASTER_API_KEY; else process.env.TICKETMASTER_API_KEY = originalKey;
  }
});
test('publishing an outside event revalidates city/time and stores only provider-trusted reference', async () => {
  let saved, fresh, catalog = { status: 'ready', events: [{ ...normalizeCityEvent(raw(), now), startsAt: '2026-10-03T23:00:00Z' }] };
  const db = { from: table => ({
    insert: row => { saved = row; return { select: () => ({ single: async () => ({ data: { id: row.id }, error: null }) }) }; },
    upsert: () => Promise.resolve({ error: null }),
  }), rpc: async () => ({ error: null }) };
  const { POST } = await loadTs('app/api/friend/activities/route.ts', {
    'next/server': nextMock, '@/lib/auth': { getCurrentUser: async () => ({ id: 'host', age: 30, gender: 'f' }) },
    '@/lib/supabase': { supabaseAdmin: db }, '@/lib/friend-matching': { isLgbtqIdentity: () => false },
    '@/lib/quiz-data': { metroOf: () => 'boston' }, '@/lib/friend-location': { friendLocationContext: async () => ({ metro: 'boston', area: 'Boston' }) },
    '@/lib/friend-activity-access': { hasFriendActivityHistory: () => false }, '@/lib/rate-limit': { rateLimit: async () => ({ ok: true }) },
    '@/lib/plan-discovery': { validateSocialPlan: () => 4 }, '@/lib/neighborhoods': { planAreasForMetro: () => ['Boston'], planAreaDistance: () => null },
    '@/lib/plan-location': { validatePlanLocation: () => ({ area: 'Boston', location: null, visibility: 'participants' }), visiblePlanVenue: () => ({}) },
    '@/lib/city-events-server': { cityEvents: async (metro, recheck) => { assert.equal(metro, 'boston'); fresh = recheck; return catalog; } },
    '@/lib/city-events': { ticketmasterUrl },
  });
  const payload = { client_id: '00000000-0000-4000-8000-000000000001', title: 'Come with me', kind: 'event', external_event_id: 'live:tm:event_1', external_event_url: 'https://evil.test', happens_at: '2026-10-03T23:00:00Z' };
  const request = p => new Request('http://localhost/api/friend/activities', { method: 'POST', body: JSON.stringify(p) });
  assert.equal((await POST(request({ ...payload, happens_at: '2030-01-01' }))).status, 409);
  assert.equal(saved, undefined);
  assert.equal((await POST(request(payload))).status, 200); assert.equal(fresh, true);
  assert.equal(saved.external_event_url, 'https://www.ticketmaster.com/event/1');
  catalog = { status: 'unavailable', events: [] }; saved = undefined;
  assert.equal((await POST(request(payload))).status, 503); assert.equal(saved, undefined);
  catalog = { status: 'ready', events: [] };
  assert.equal((await POST(request(payload))).status, 409); assert.equal(saved, undefined);
});
