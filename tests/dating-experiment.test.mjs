import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const experimentSource = readFileSync(new URL('../lib/raffle.ts', import.meta.url), 'utf8');

test('Dating Experiment stays quiet, free, local, and payment-neutral', () => {
  assert.match(experimentSource, /series:\s*'The NotCupid Dating Experiment'/);
  assert.match(experimentSource, /entriesOpen:\s*false/);
  assert.match(experimentSource, /centerZip:\s*'02116'/);
  assert.match(experimentSource, /radiusMiles:\s*20/);
  assert.doesNotMatch(experimentSource, /proEntries/);
  assert.match(experimentSource, /distance\s*<=\s*RAFFLE\.radiusMiles/);
});

test('selection weight is bounded and compatibility score remains normalized', () => {
  assert.match(experimentSource, /minimumPairScore:\s*55/);
  assert.match(experimentSource, /Math\.min\(3,/);
  assert.match(experimentSource, /Math\.max\(0,\s*Math\.min\(100,/);
  assert.match(experimentSource, /base\s*\*\s*0\.75\s*\+\s*sharedScore\s*\*\s*0\.15\s*\+\s*answerScore\s*\*\s*0\.10/);
});

test('entry requires versioned, separate consent records', () => {
  const source = readFileSync(new URL('../app/api/raffle/enter/route.ts', import.meta.url), 'utf8');
  for (const required of [
    'terms_version',
    'terms_accepted_at',
    'video_consent_at',
    'safety_acknowledged_at',
    'attendance_confirmed_at',
  ]) assert.match(source, new RegExp(required));
});

test('experiment terms do not bundle a marketing likeness license', () => {
  const terms = readFileSync(new URL('../app/dating-experiment/terms/page.tsx', import.meta.url), 'utf8');
  assert.match(terms, /requires separate written consent/i);
  assert.doesNotMatch(terms, /royalty-free, worldwide license/i);
});
