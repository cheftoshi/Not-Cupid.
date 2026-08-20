import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  connectionBrief,
  conciergeHref,
  curatedConciergeRecommendation,
  explicitMemorySuggestion,
  normalizeConnectionMemorySuggestion,
  normalizeConciergeRecommendation,
} from '../lib/connection-concierge.ts';

const inventory = (overrides = {}) => ({
  firstName: 'Sunny', city: 'Boston', archetype: 'curious realist', interests: ['tennis', 'sushi'],
  profileReady: true, hasArchetype: true, needsLoveDeep: false, friendOptedIn: true,
  isTraveling: false, sealedFriendCount: 0,
  love: [], friends: [], plans: [], ...overrides,
});

test('Hub concierge prioritizes a real reciprocal decision over more Love browsing', () => {
  const result = curatedConciergeRecommendation('help me find a date', inventory({
    love: [
      { id: 'waiting-id', name: 'Ari', state: 'waiting' },
      { id: 'answer-id', name: 'Maya', state: 'needs_answer' },
    ],
  }));
  assert.equal(result.action, 'open_match');
  assert.equal(result.target, 'answer-id');
  assert.equal(result.href, '/match/answer-id');
  assert.match(result.message, /Maya/);
});

test('Hub concierge returns a concrete real plan and never auto-RSVPs', () => {
  const result = curatedConciergeRecommendation('what can I do around me tonight?', inventory({
    plans: [{ id: 'plan-1', title: 'Beginner tennis mixer', category: 'active', area: 'Back Bay', when: 'Tue 7:00 PM', going: 4 }],
  }));
  assert.equal(result.action, 'open_friend_plan');
  assert.equal(result.href, '/friends?view=scene&plan=plan-1');
  assert.match(result.message, /nothing is joined automatically/i);
});

test('AI output with an invented target falls back to validated inventory', () => {
  const current = inventory({
    plans: [{ id: 'real-plan', title: 'Book club', category: 'culture', area: 'Cambridge', when: 'Wed 6:30 PM', going: 3 }],
  });
  const result = normalizeConciergeRecommendation({
    intent: 'plan', message: 'I found something.', cta: 'join it', action: 'open_friend_plan',
    target: 'invented-plan', reasonCodes: ['nearby'], confidence: 'high',
  }, 'find something to do nearby', current);
  assert.equal(result.source, 'curated');
  assert.equal(result.target, 'real-plan');
  assert.equal(conciergeHref('open_friend_plan', 'https://evil.example', current), null);
});

test('A vague request gets one clarification instead of fabricated inventory', () => {
  const result = curatedConciergeRecommendation('help me', inventory());
  assert.equal(result.action, 'none');
  assert.equal(result.href, null);
  assert.match(result.message, /date, a friend, something to do/i);
});

test('Live connection brief prioritizes reciprocal action and stays compact', () => {
  const brief = connectionBrief(inventory({
    love: [
      { id: 'chat-id', name: 'Ari', state: 'chat_open' },
      { id: 'answer-id', name: 'Maya', state: 'needs_answer' },
    ],
    plans: [{ id: 'plan-1', title: 'Tennis mixer', category: 'active', area: 'Back Bay', when: 'Tue 7:00 PM', going: 4 }],
  }));
  assert.match(brief.headline, /choice waiting/i);
  assert.match(brief.message, /Maya/);
  assert.ok(brief.signals.length <= 3);
});

test('Connection memory is proposed only from explicit input and remains bounded', () => {
  assert.equal(explicitMemorySuggestion('I like tennis'), null);
  const explicit = explicitMemorySuggestion('Remember that I prefer small groups');
  assert.equal(explicit?.category, 'preference');
  assert.equal(explicit?.value, 'I prefer small groups');

  const normalized = normalizeConnectionMemorySuggestion({
    shouldRemember: true,
    category: 'boundary',
    key: 'Nearby only!!',
    value: 'Keep plans within 5 miles',
    expiresInDays: 50000,
  });
  assert.equal(normalized?.key, 'nearby-only');
  assert.equal(normalized?.expiresInDays, 3650);
  assert.equal(normalizeConnectionMemorySuggestion({ shouldRemember: false }), null);
  assert.equal(normalizeConnectionMemorySuggestion({
    shouldRemember: true,
    category: 'location',
    key: 'home',
    value: 'My ZIP is 02116',
    expiresInDays: 0,
  }), null);
});

test('Hub concierge is consented, bounded, measurable, and phone-first', () => {
  const route = readFileSync(new URL('../app/api/concierge/route.ts', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../app/hub/connection-concierge.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../app/hub/hub-shell.module.css', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/20260818220000_hub_connection_concierge_v1.sql', import.meta.url), 'utf8');
  const memoryMigration = readFileSync(new URL('../supabase/migrations/20260820034945_connection_concierge_v2.sql', import.meta.url), 'utf8');
  const hub = readFileSync(new URL('../app/hub/hub-client.tsx', import.meta.url), 'utf8');
  const privacy = readFileSync(new URL('../app/privacy/page.tsx', import.meta.url), 'utf8');

  assert.match(route, /AI consent required/);
  assert.match(route, /maxAttempts: 20/);
  assert.match(route, /Never invent a person, event, group/);
  assert.match(route, /cannot accept, message, RSVP, join, post, book, or pay/);
  assert.match(route, /concierge_recommendation_shown/);
  assert.match(route, /export async function GET/);
  assert.match(route, /concierge_memory_confirmed/);
  assert.match(route, /concierge_recommendation_corrected/);
  assert.match(route, /hub-concierge-memory:/);
  assert.match(client, /agree &amp; ask/);
  assert.match(client, /Raw chat stays on this device/);
  assert.match(client, /Remember this for next time/);
  assert.match(client, /too far/);
  assert.doesNotMatch(client, /microphone|MediaRecorder|SpeechRecognition|audio/i);
  assert.match(css, /\.conciergeComposer textarea[\s\S]*font-size: 16px/);
  assert.match(css, /height: calc\(100dvh - var\(--app-top-nav-height/);
  assert.match(css, /var\(--app-safe-bottom/);
  assert.match(hub, /<ConnectionConcierge/);
  assert.doesNotMatch(hub, /RaffleCard|friend\/activities|profileMini|membershipCard/);
  assert.match(migration, /create table if not exists public\.connection_intents/);
  assert.match(migration, /create table if not exists public\.concierge_recommendations/);
  assert.doesNotMatch(migration, /raw_prompt\s+text/i);
  assert.match(memoryMigration, /create table if not exists public\.connection_memories/);
  assert.match(memoryMigration, /source = 'user_confirmed'/);
  assert.match(memoryMigration, /grant select, insert, update, delete on table public\.connection_memories to service_role/);
  assert.doesNotMatch(memoryMigration, /raw_prompt|conversation_text|transcript/i);
  assert.match(privacy, /Nothing is saved unless you tap to approve it/);
});

test('Hub concierge never recommends a plan that has already reached capacity', () => {
  const inventory = readFileSync(new URL('../lib/connection-concierge-server.ts', import.meta.url), 'utf8');
  assert.match(inventory, /activity\.capacity == null \|\| \(goingByPlan\.get\(activity\.id\) \|\| 0\) < activity\.capacity/);
  assert.match(inventory, /plans: joinableActivities\.map/);
});
