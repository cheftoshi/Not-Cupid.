import test from 'node:test';
import assert from 'node:assert/strict';
import { freeLoveProfileView } from '../lib/love-deep-dive.ts';

test('free roster view keeps profile basics and strips only mutual-only fields', () => {
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

test('profile privacy filtering never introduces a payment flag', () => {
  const profile = freeLoveProfileView({ bio: 'hello', hobbies: ['books'], prompts: [{ answer: 'yes' }] });
  assert.equal(profile.bio, 'hello');
  assert.deepEqual(profile.hobbies, ['books']);
  assert.equal('paywall' in profile, false);
});
