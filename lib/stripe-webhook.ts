import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify a Stripe webhook signature without pulling in the full `stripe` SDK.
 * Mirrors what `stripe.webhooks.constructEvent` does internally.
 *
 * Stripe sends header: `stripe-signature: t=<timestamp>,v1=<sig>[,v1=<sig>]...`
 * The signed payload is `<timestamp>.<rawBody>`, HMAC-SHA256 with the webhook secret.
 */
export function verifyStripeSignature(args: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSec?: number;
}): { ok: true } | { ok: false; reason: string } {
  const { rawBody, signatureHeader, secret, toleranceSec = 300 } = args;
  if (!signatureHeader) return { ok: false, reason: 'missing signature header' };
  if (!secret) return { ok: false, reason: 'missing webhook secret' };

  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') {
      const n = parseInt(v, 10);
      if (!isNaN(n)) timestamp = n;
    } else if (k === 'v1') {
      signatures.push(v);
    }
  }

  if (timestamp === null) return { ok: false, reason: 'no timestamp in signature' };
  if (signatures.length === 0) return { ok: false, reason: 'no v1 signature' };

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > toleranceSec) {
    return { ok: false, reason: 'timestamp outside tolerance' };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  for (const sig of signatures) {
    let sigBuf: Buffer;
    try {
      sigBuf = Buffer.from(sig, 'hex');
    } catch {
      continue;
    }
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
      return { ok: true };
    }
  }

  return { ok: false, reason: 'signature mismatch' };
}
