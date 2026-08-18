import test from 'node:test';
import assert from 'node:assert/strict';
import { freeLoveProfileView, loveDeepDiveSummary } from '../lib/love-deep-dive.ts';

test('an empty profile never becomes a purchasable deep-dive', () => {
  assert.deepEqual(loveDeepDiveSummary({ relationship_style: 'long-term' }), {
    available: false,
    items: [],
    galleryCount: 0,
  });
});

test('compatibility answers create an itemized deep-dive without gating the bio', () => {
  const summary = loveDeepDiveSummary({
    music: ['Jazz', 'jazz', 'House'],
    values_profile: { family: 'important' },
    attach_style: 'secure',
  });
  assert.equal(summary.available, true);
  assert.deepEqual(summary.items, ['values & relationship fit', 'communication style']);
});

test('free view keeps profile basics and strips only deep-dive fields', () => {
  const profile = freeLoveProfileView({
    id: 'person-1',
    name: 'Ari',
    photo_url: '/ari.jpg',
    relationship_style: 'long-term',
    bio: 'public bio',
    gallery: ['/extra.jpg'],
    hobbies: ['climbing'],
    values_profile: { family: true },
    attach_style: 'secure',
  });
  assert.equal(profile.name, 'Ari');
  assert.equal(profile.relationship_style, 'long-term');
  assert.equal(profile.bio, 'public bio');
  assert.deepEqual(profile.gallery, []);
  assert.deepEqual(profile.hobbies, ['climbing']);
  assert.equal(profile.values_profile, null);
  assert.equal(profile.attach_style, null);
});

test('bio, interests and prompts alone never create a paywall', () => {
  const summary = loveDeepDiveSummary({
    bio: 'A real bio',
    hobbies: ['climbing'],
    prompts: [{ question: 'A tiny thing that makes my day is…', answer: 'Coffee.' }],
  });
  assert.equal(summary.available, false);
  assert.deepEqual(summary.items, []);
});
