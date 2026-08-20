import { createHmac, timingSafeEqual } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function secret(): string {
  const value = process.env.WINNER_CONFIRMATION_SECRET || process.env.MATCH_LINK_SECRET;
  if (!value || value.length < 16) throw new Error('Winner confirmation signing secret is not set or too short');
  return value;
}

function signature(drawId: string, userId: string, exp: string): string {
  return createHmac('sha256', secret())
    .update(`winner-confirm-v1.${drawId}.${userId}.${exp}`)
    .digest('base64url');
}

export function signWinnerConfirmation(input: {
  drawId: string;
  userId: string;
  expiresAt?: number;
}): string {
  if (!UUID_RE.test(input.drawId) || !UUID_RE.test(input.userId)) throw new Error('Invalid winner confirmation subject');
  const exp = Math.floor(input.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000).toString(36);
  return `${exp}.${signature(input.drawId, input.userId, exp)}`;
}

export function verifyWinnerConfirmation(input: {
  drawId: string | null;
  userId: string | null;
  token: string | null;
}): boolean {
  if (!input.drawId || !input.userId || !input.token || !UUID_RE.test(input.drawId) || !UUID_RE.test(input.userId)) return false;
  const [exp, provided, extra] = input.token.split('.');
  const expiresAt = Number.parseInt(exp, 36);
  if (!exp || !provided || extra || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = signature(input.drawId, input.userId, exp);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
