import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderFriendAnnouncementMessage, FRIEND_ANNOUNCEMENT_BODY } from '../lib/friend-announcement-message.ts';
const unsubscribeUrl = 'https://notcupid.com/unsubscribe?u=synthetic-user&t=synthetic-signed-token';
const exactBody = `Hey,

A quick Friend Line update: you can now find Boston events and people to go with.

There’s music, comedy, food, workshops and more. If something catches your eye, see whether there’s a plan to join or start one yourself.

Find your next plan

Take a look for this weekend. We’d love to know what you want to see more of.

NotCupid

Check the organizer’s listing for tickets or registration.`;

test('one-time announcement preserves exact supplied subject, body, sender and CTA', () => {
  assert.equal(FRIEND_ANNOUNCEMENT_BODY, exactBody);
  const message = renderFriendAnnouncementMessage({ unsubscribeUrl });
  assert.equal(message.subject, 'Got plans this weekend?');
  assert.equal(message.from, 'NotCupid <match@notcupid.com>');
  assert.equal(message.replyTo, 'match@notcupid.com');
  assert(message.text.startsWith(exactBody.replace('Find your next plan', 'Find your next plan\nhttps://notcupid.com/hub?discover=1')));
  const displayedBody = message.html.split('<hr>')[0].replace(/<[^>]*>/g, '\n').split('\n').filter(Boolean).join('\n\n');
  assert.equal(displayedBody, exactBody);
  assert.match(message.html, /<a href="https:\/\/notcupid.com\/hub\?discover=1">Find your next plan<\/a>/);
});

test('caller-supplied links remain explicit and HTML escaped, with proposed global footer', () => {
  const ctaUrl = 'https://notcupid.com/hub?discover=1&from=friend-announcement';
  const message = renderFriendAnnouncementMessage({ ctaUrl, unsubscribeUrl });
  assert(message.text.includes(ctaUrl));
  assert(message.html.includes('discover=1&amp;from=friend-announcement'));
  assert.equal(message.unsubscribeUrl, unsubscribeUrl);
  assert.equal(message.unsubscribePostUrl, 'https://notcupid.com/api/unsubscribe?u=synthetic-user&t=synthetic-signed-token');
  assert.equal(new URL(message.unsubscribePostUrl).search, new URL(unsubscribeUrl).search);
  assert(message.html.includes('u=synthetic-user&amp;t=synthetic-signed-token'));
  assert.doesNotMatch(message.text, /You’re receiving this/);
  assert(message.text.includes('Unsubscribe from marketing emails'));
  assert(message.text.includes('109 California Ave, Quincy, MA 02169'));
  assert.doesNotMatch(message.text, /You chose Friend event emails|once a week/);
});

test('unsafe links and recurring-list unsubscribe cannot replace global unsubscribe', () => {
  for (const ctaUrl of ['javascript:alert(1)', 'http://notcupid.com/hub', 'https://notcupid.com.evil.test', 'https://user@notcupid.com/hub', 'https://notcupid.com/hub#token', 'https://notcupid.com:8443/hub']) {
    assert.throws(() => renderFriendAnnouncementMessage({ ctaUrl, unsubscribeUrl }));
  }
  for (const url of ['https://notcupid.com/api/friend-events/unsubscribe?token=test', 'https://notcupid.com/unsubscribe', 'https://notcupid.com/unsubscribe?u=synthetic-user', 'https://elsewhere.test/unsubscribe?u=x&t=y']) {
    assert.throws(() => renderFriendAnnouncementMessage({ unsubscribeUrl: url }));
  }
});

test('pure renderer has no provider, recurring preference, activation or scheduling surface', () => {
  const source = readFileSync(new URL('../lib/friend-announcement-message.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /\bfetch\s*\(|process\.env|supabase|new Resend|setInterval/);
  assert.deepEqual(Object.keys(renderFriendAnnouncementMessage({ unsubscribeUrl })).sort(), ['from','html','replyTo','subject','text','unsubscribePostUrl','unsubscribeUrl']);
});
