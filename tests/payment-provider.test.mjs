import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { classifyStripeFailure } from '../lib/stripe-failure.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Stripe failures are reduced to safe operational codes', () => {
  assert.equal(classifyStripeFailure(400, { error: { message: 'Your account cannot currently make live charges.' } }), 'account_charges_disabled');
  assert.equal(classifyStripeFailure(401, { error: { message: 'Invalid API Key provided' } }), 'authentication_failed');
  assert.equal(classifyStripeFailure(429, { error: { type: 'rate_limit_error' } }), 'provider_rate_limited');
  assert.equal(classifyStripeFailure(503, null), 'provider_unavailable');
  assert.equal(classifyStripeFailure(400, { error: { code: 'parameter_invalid_integer' } }), 'provider_rejected');
});

test('all live checkout routes record click, session creation, and safe failure metadata', () => {
  for (const path of [
    '../app/api/match/connection-checkout/route.ts',
    '../app/api/friend/checkout/route.ts',
    '../app/api/pro/checkout/route.ts',
  ]) {
    const source = read(path);
    assert.match(source, /event: 'checkout_clicked'/);
    assert.match(source, /createStripeCheckoutSession/);
    assert.match(source, /event: 'stripe_session_created'/);
    assert.match(source, /failure_code/);
    assert.match(source, /PAYMENT_TEMPORARILY_UNAVAILABLE_MESSAGE/);
    assert.doesNotMatch(source, /console\.error\([^\n]*session/);
  }
});

test('payment availability state is service-only and stores no provider payload', () => {
  const migration = read('../supabase/migrations/20260820102349_payment_provider_checkout_observability.sql');
  const provider = read('../lib/payment-provider.ts');
  assert.match(migration, /revoke all on table public\.payment_provider_state from public, anon, authenticated/);
  assert.match(migration, /claim_payment_provider_request/);
  assert.match(migration, /probe_generation/);
  assert.doesNotMatch(migration, /provider_payload|raw_error|secret_key/);
  assert.match(provider, /circuit_open/);
  assert.match(provider, /Nothing was charged/);
  assert.match(provider, /Idempotency-Key.*generation/s);
});
