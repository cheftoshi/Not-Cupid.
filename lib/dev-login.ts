import { createHmac, timingSafeEqual } from 'crypto';

// Signed, expiring magic-login token for TEST accounts only. Verified server-
// side AND gated to is_test users in the route — a leaked link can at worst
// log into a throwaway test account, never a real user.

function secret(): string {
  const s = process.env.MATCH_LINK_SECRET;
  if (!s || s.length < 16) throw new Error('MATCH_LINK_SECRET is not set or too short');
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signDevLogin(userId: string, expMs: number): string {
  return b64url(createHmac('sha256', secret()).update(`${userId}.${expMs}`).digest());
}

export function verifyDevLogin(userId: string, expMs: number, sig: string | null | undefined): boolean {
  if (!sig || !Number.isFinite(expMs) || Date.now() > expMs) return false;
  const expected = signDevLogin(userId, expMs);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Build a full /api/dev-login URL valid for `ttlMs` (default 24h).
export function devLoginUrl(baseUrl: string, userId: string, ttlMs = 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const sig = signDevLogin(userId, exp);
  return `${baseUrl}/api/dev-login?u=${encodeURIComponent(userId)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;
}
