import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPES, DIMS, QUESTIONS, computeScores, pickArchetype, typeSlug } from '../lib/quiz-data.ts';
import { loadTs } from './helpers/load-ts.mjs';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

const vector = values => Object.fromEntries(DIMS.map((dim, i) => [dim, values[i]]));

test('top two dimensions reach every archetype, including both Grounded paths', () => {
  const cases = [
    [[4,4,4,4,4,8], 'The Curious Realist'],
    [[8,6,4,4,4,5], 'The Principled Adventurer'],
    [[4,8,4,4,4,4], 'The Warm Skeptic'],
    [[4,4,4,8,4,4], 'The Grounded Optimist'],
    [[4,4,4,4,8,4], 'The Grounded Optimist'],
    [[4,4,8,4,4,4], 'The Deliberate Charmer'],
    [[8,4,4,4,4,7], 'The Honest Eccentric'],
  ];
  assert.deepEqual(new Set(cases.map(([scores, expected]) => {
    assert.equal(pickArchetype(vector(scores)).name, expected);
    return expected;
  })), new Set(ARCHETYPES.map(a => a.name)));
});

test('ties compare scored answers, then H O X E A C, including second place', () => {
  // H options score 2+3=5, O scores 4+1=5: O wins on 4.
  const answers = [1,1,3,3,3,3,3,3,3,3,0,3];
  assert.equal(pickArchetype(computeScores(answers), answers).name, 'The Curious Realist');
  // H leads; X and O tie at 5. X's 4 beats O's 3, so second is NOT O.
  const second = [0,0,3,3,0,3,3,3,3,3,1,2];
  assert.equal(pickArchetype(computeScores(second), second).name, 'The Principled Adventurer');
  // Equal second-place maxima fall back to O before X.
  second[10] = 0; second[11] = 3;
  assert.equal(pickArchetype(computeScores(second), second).name, 'The Honest Eccentric');
  const skipped = QUESTIONS.map(() => -1);
  assert.equal(pickArchetype(computeScores(skipped), skipped).name, 'The Honest Eccentric');
  const order = ['Honesty-Humility','Openness','Extraversion','Emotionality','Agreeableness','Conscientiousness'];
  const expected = ['The Honest Eccentric','The Curious Realist','The Deliberate Charmer','The Warm Skeptic','The Grounded Optimist','The Grounded Optimist'];
  order.forEach((_, i) => {
    const scores = Object.fromEntries(order.map((dim, j) => [dim, j < i ? 2 : 8]));
    assert.equal(pickArchetype(scores).name, expected[i]);
  });
  assert.deepEqual(answers, [1,1,3,3,3,3,3,3,3,3,0,3]);
});

test('5000 seeded random valid answer sets cover all six without >40% concentration', t => {
  // Reproducible uniform option sampling is a regression test, not a claim
  // about the distribution of real users' personalities or answers.
  let seed = 20260928;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const counts = Object.fromEntries(ARCHETYPES.map(a => [a.name, 0]));
  for (let i = 0; i < 5000; i++) {
    const answers = QUESTIONS.map(q => Math.floor(random() * q.opts.length));
    counts[pickArchetype(computeScores(answers), answers).name]++;
  }
  for (const [name, count] of Object.entries(counts)) {
    assert.ok(count > 0, `${name} unreachable`);
    assert.ok(count <= 2000, `${name} exceeds 40%: ${count}/5000`);
  }
  t.diagnostic(JSON.stringify(counts));
});

test('all six public archetype slugs remain stable and unique', () => {
  assert.deepEqual(ARCHETYPES.map(a => typeSlug(a.name)), [
    'curious-realist','principled-adventurer','warm-skeptic',
    'grounded-optimist','deliberate-charmer','honest-eccentric',
  ]);
});

test('each public type page and OG card renders its matching archetype', async () => {
  const shared = { '@/lib/quiz-data': { ARCHETYPES, typeSlug }, 'react/jsx-runtime': jsxRuntime };
  const page = await loadTs('app/type/[slug]/page.tsx', {
    ...shared, 'next/navigation': { redirect: () => { throw Error('Unexpected redirect'); } },
  });
  const og = await loadTs('app/type/[slug]/opengraph-image.tsx', {
    ...shared, 'next/og': { ImageResponse: class { constructor(element, size) { this.element = element; this.size = size; } } },
  });
  assert.deepEqual(page.generateStaticParams(), ARCHETYPES.map(a => ({ slug: typeSlug(a.name) })));
  for (const archetype of ARCHETYPES) {
    const props = { params: Promise.resolve({ slug: typeSlug(archetype.name) }) };
    assert.ok(renderToStaticMarkup(await page.default(props)).includes(archetype.name));
    assert.equal((await page.generateMetadata(props)).title, `${archetype.name} — my NotCupid type`);
    const card = await og.default(props);
    assert.ok(renderToStaticMarkup(card.element).includes(archetype.name));
    assert.deepEqual(card.size, { width: 1200, height: 630 });
  }
});
