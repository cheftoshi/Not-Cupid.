import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { profileReadiness } from '../lib/profile-readiness.ts';

const ready = {
  age: 30, gender: 'm', seeking: 'f', zip: '02116', archetype: 'warm skeptic', score_honesty: 4,
  photo_url: 'https://example.com/a.jpg', bio: 'A real bio', music: ['jazz'], food: ['ramen'], hobbies: ['running'],
  prompts: [{ answer: 'Ask me about Boston.' }], relationship_style: 'open', attach_style: 'secure',
};

test('profile readiness separates match eligibility from useful profile completion', () => {
  const result = profileReadiness(ready);
  assert.equal(result.coreReady, true);
  assert.equal(result.complete, true);
  assert.equal(result.percent, 100);
});

test('optional video and gallery do not falsely make a profile incomplete', () => {
  const result = profileReadiness(ready);
  assert.equal(result.bonuses.find((item) => item.key === 'video')?.ready, false);
  assert.equal(result.bonuses.find((item) => item.key === 'gallery')?.ready, false);
  assert.equal(result.complete, true);
});

test('missing profile card items are exact and actionable', () => {
  const result = profileReadiness({ ...ready, bio: '', prompts: [] });
  assert.deepEqual(result.missing.map((item) => item.label), ['short bio', 'conversation prompt']);
  assert.equal(result.percent, 67);
});

test('completion cards open the profile directly in edit mode', () => {
  const hub = readFileSync(new URL('../app/hub/hub-client.tsx', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.match(hub, /\/profile\?mode=edit&from=hub-completion/);
  assert.match(dashboard, /\/profile\?mode=edit&from=love-completion/);
  assert.match(hub, /Still missing:/);
});
