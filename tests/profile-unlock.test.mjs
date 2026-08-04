import test from 'node:test';
import assert from 'node:assert/strict';
import { lockedProfileView, profileUnlockSummary } from '../lib/profile-unlock.ts';

test('an empty profile never becomes a purchasable unlock', () => {
  assert.deepEqual(profileUnlockSummary({ relationship_style: 'long-term' }), {
    available: false,
    items: [],
    galleryCount: 0,
    interestCount: 0,
  });
});

test('compatibility answers create an itemized unlock even without a bio', () => {
  const summary = profileUnlockSummary({
    music: ['Jazz', 'jazz', 'House'],
    values_profile: { family: 'important' },
    attach_style: 'secure',
  });
  assert.equal(summary.available, true);
  assert.equal(summary.interestCount, 2);
  assert.deepEqual(summary.items, ['2 interests', 'values & relationship fit', 'communication style']);
});

test('locked view strips every paid field while retaining free identity fields', () => {
  const locked = lockedProfileView({
    id: 'person-1',
    name: 'Ari',
    photo_url: '/ari.jpg',
    relationship_style: 'long-term',
    bio: 'private bio',
    gallery: ['/extra.jpg'],
    hobbies: ['climbing'],
    values_profile: { family: true },
    attach_style: 'secure',
  });
  assert.equal(locked.name, 'Ari');
  assert.equal(locked.relationship_style, 'long-term');
  assert.equal(locked.bio, null);
  assert.deepEqual(locked.gallery, []);
  assert.deepEqual(locked.hobbies, []);
  assert.equal(locked.values_profile, null);
  assert.equal(locked.attach_style, null);
});
