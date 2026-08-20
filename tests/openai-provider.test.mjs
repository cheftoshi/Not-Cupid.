import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privacySafeAiUserId } from '../lib/ai.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('AI provider is centralized on the stateless OpenAI Responses API', () => {
  const helper = read('../lib/ai.ts');
  const pkg = JSON.parse(read('../package.json'));

  assert.equal(typeof pkg.dependencies.openai, 'string');
  assert.equal(pkg.dependencies['@anthropic-ai/sdk'], undefined);
  assert.match(helper, /responses\.create/);
  assert.match(helper, /gpt-5\.6-luna/);
  assert.match(helper, /OPENAI_API_KEY/);
  assert.match(helper, /store: false/);
  assert.match(helper, /type: 'json_schema'/);
  assert.match(helper, /strict: true/);
  assert.match(helper, /safety_identifier/);
  assert.doesNotMatch(helper, /ANTHROPIC_API_KEY|claudeJSON|messages\.create/);
});

test('every generative route sends a hashed safety identifier and keeps its fallback gate', () => {
  const routes = [
    '../app/api/concierge/route.ts',
    '../app/api/friend/today-move/route.ts',
    '../app/api/matches/[id]/coach/route.ts',
    '../app/api/love/compatibility-read/[candidateId]/route.ts',
  ];
  for (const routePath of routes) {
    const route = read(routePath);
    assert.match(route, /generateStructured/);
    assert.match(route, /privacySafeAiUserId\(user\.id\)/);
    assert.match(route, /aiEnabled\(\)/);
    assert.doesNotMatch(route, /claude|anthropic/i);
  }
  assert.match(read('../app/api/friend/today-move/route.ts'), /maxAttempts: 4/);
});

test('AI safety identifier is stable, opaque, and never the raw account id', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const first = privacySafeAiUserId(userId);
  assert.equal(first, privacySafeAiUserId(userId));
  assert.notEqual(first, userId);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('the current AI data boundary requires fresh Hub consent and is disclosed', () => {
  const policy = read('../app/privacy/page.tsx');
  const client = read('../app/hub/connection-concierge.tsx');
  const contract = read('../lib/connection-concierge.ts');

  assert.match(contract, /hub-concierge-openai-v3-2026-08-19/);
  assert.match(client, /to OpenAI/);
  assert.match(client, /Saved memory requires a separate tap/);
  assert.match(policy, /Responses API application-state storage/);
  assert.match(policy, /abuse-monitoring logs for up to 30 days/);
  assert.doesNotMatch(`${policy}\n${client}`, /Anthropic/);
});
