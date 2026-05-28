import { createHmac, timingSafeEqual } from 'crypto';

type MatchAction = 'accept' | 'pass';

function getSecret(): string {
  const secret = process.env.MATCH_LINK_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('MATCH_LINK_SECRET is not set or too short (need >= 16 chars)');
  }
  return secret;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signMatchToken(args: {
  matchId: string;
  userId: string;
  action: MatchAction;
}): string {
  const payload = `${args.matchId}.${args.userId}.${args.action}`;
  const mac = createHmac('sha256', getSecret()).update(payload).digest();
  return base64url(mac);
}

export function verifyMatchToken(args: {
  matchId: string;
  userId: string;
  action: MatchAction;
  token: string | null | undefined;
}): boolean {
  if (!args.token) return false;
  let provided: Buffer;
  try {
    const padded = args.token.replace(/-/g, '+').replace(/_/g, '/');
    provided = Buffer.from(padded, 'base64');
  } catch {
    return false;
  }
  const expected = createHmac('sha256', getSecret())
    .update(`${args.matchId}.${args.userId}.${args.action}`)
    .digest();
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}
