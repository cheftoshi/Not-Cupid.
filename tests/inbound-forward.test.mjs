import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildInboundForward,
  isMatchInboxRecipient,
  plainTextFromHtml,
} from '../lib/inbound-forward.ts';
import { extractEmailAddress } from '../lib/email-address.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('match inbox recognition is exact and includes received_for', () => {
  assert.equal(isMatchInboxRecipient(['match@notcupid.com']), true);
  assert.equal(isMatchInboxRecipient([], ['Match <match@notcupid.com>']), true);
  assert.equal(isMatchInboxRecipient(['other@notcupid.com']), false);
  assert.equal(isMatchInboxRecipient(['match@notcupid.com.attacker.test']), false);
});

test('email extraction rejects header injection', () => {
  assert.equal(extractEmailAddress('Person <person@example.com>'), 'person@example.com');
  assert.equal(extractEmailAddress('person@example.com\r\nBcc: victim@example.com'), null);
  assert.equal(extractEmailAddress('not-an-email'), null);
});

test('forwarded mail replies to the original sender and safely renders content', () => {
  const result = buildInboundForward({
    from: 'Person <person@example.com>',
    to: ['match@notcupid.com'],
    replyTo: ['reply@example.com'],
    subject: 'Need help\r\nBcc: ignored@example.com',
    text: '<script>alert(1)</script> & hello',
  });

  assert.equal(result.replyTo, 'reply@example.com');
  assert.equal(result.subject, 'Fwd: Need help Bcc: ignored@example.com');
  assert.match(result.text, /Forwarded from the NotCupid inbox/);
  assert.doesNotMatch(result.html, /<script>alert/);
  assert.match(result.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; hello/);
});

test('HTML-only inbound messages get a readable text fallback', () => {
  assert.equal(plainTextFromHtml('<p>Hello &amp; welcome</p><p>Second line</p>'), 'Hello & welcome\nSecond line');
});

test('inbound forwarding archives first and is retry-idempotent', () => {
  const route = source('app/api/inbound/route.ts');
  assert.ok(route.indexOf("from('inbound_messages').insert") < route.indexOf('resend.emails.send'));
  assert.match(route, /idempotencyKey: `inbound-forward-\$\{emailId\}`/);
  assert.match(route, /isMatchInboxRecipient\(email\.to \|\| \[\], email\.received_for \|\| \[\]\)/);
});

test('legacy direct Resend senders use the configured operator reply address', () => {
  const routes = [
    'app/api/admin/send-friend-blast/route.ts',
    'app/api/admin/send-press-invite/route.ts',
    'app/api/admin/send-quiz-blast/route.ts',
    'app/api/stripe-webhook/route.ts',
  ];
  for (const route of routes) {
    assert.match(source(route), /reply_to: defaultEmailReplyTo\(\)/, `${route} must route replies to the operator inbox`);
  }
  const retiredPendingSender = source('app/api/admin/send-pending-matches/route.ts');
  assert.match(retiredPendingSender, /previewOnly: true/);
  assert.doesNotMatch(retiredPendingSender, /api\.resend\.com|sendEmail\(|resend\.emails\.send/);
});
