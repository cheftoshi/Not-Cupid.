import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('profile edits do not echo server-managed rows or reject a legacy null vibe', () => {
  const form = source('app/profile/profile-form.tsx');
  const api = source('app/api/profile/route.ts');
  assert.match(form, /const editableFields = \[/);
  assert.match(form, /body: JSON\.stringify\(payload\)/);
  assert.doesNotMatch(form, /body: JSON\.stringify\(user\)/);
  assert.match(api, /updates\.vibes != null && !validJson\(updates\.vibes\)/);
});

test('mobile profile saves preserve rapid edits and include the final interest draft', () => {
  const form = source('app/profile/profile-form.tsx');
  const chips = source('app/profile/chip-input.tsx');

  assert.match(form, /setUser\(\(current: any\) => \(\{ \.\.\.current, \.\.\.patch \}\)\)/);
  assert.match(form, /dirtyFields\.current\.has\(field\)/);
  assert.match(form, /foodInput\.current\?\.valueWithDraft\(\)/);
  assert.doesNotMatch(form, /onChange=\{e => setUser\(\{ \.\.\.user,/);
  assert.match(chips, /valueWithDraft: \(\) => string\[\]/);
  assert.match(chips, /onClick=\{\(\) => commit\(draft\)\}/);
});

test('Dating Experiment refreshes profile readiness after a mobile back navigation', () => {
  const client = source('app/raffle/raffle-client.tsx');
  const status = source('app/api/raffle/status/route.ts');
  assert.match(client, /addEventListener\('pageshow', refreshStatus\)/);
  assert.match(client, /profileGate\?\.requirements/);
  assert.match(status, /profileGate: \{/);
  assert.match(status, /requirements: profileReadiness\.requirements/);
});
