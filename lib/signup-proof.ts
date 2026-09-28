import { createHmac, timingSafeEqual } from 'crypto';

export const SIGNUP_PROOF_COOKIE = 'nc_signup_proof';
type SignupProof = { email: string; codeHash: string; expires: number };

function signature(payload: string) {
  const secret = process.env.MATCH_LINK_SECRET;
  if (!secret || secret.length < 16) throw new Error('Signup verification secret unavailable');
  return createHmac('sha256', secret).update(`signup-proof-v1.${payload}`).digest('hex');
}

export function issueSignupProof(email: string, codeHash: string, expiresAt: string) {
  const payload = Buffer.from(JSON.stringify({ email, codeHash, expires: Date.parse(expiresAt) })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

// The email-level verified flag alone is NOT authentication. Only the browser
// that completed OTP verification receives this HttpOnly bearer credential.
// The matching OTP record must still exist; resending a code invalidates it.
export function verifySignupProof(token: string | undefined, email: string, now = Date.now()): SignupProof | null {
  if (!token || token.length > 2048) return null;
  const [payload, mac, extra] = token.split('.');
  if (extra !== undefined || !payload || !/^[a-f0-9]{64}$/.test(mac || '')) return null;
  if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(payload), 'hex'))) return null;
  try {
    const proof = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SignupProof;
    if (proof.email !== email || !/^[a-f0-9]{64}$/.test(proof.codeHash) ||
        !Number.isFinite(proof.expires) || proof.expires <= now) return null;
    return proof;
  } catch { return null; }
}
