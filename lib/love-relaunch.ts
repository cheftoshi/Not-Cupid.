import { createHmac, timingSafeEqual } from 'crypto';

export const LOVE_RELAUNCH_CAMPAIGN = 'love_line_aug_2026';

export type LoveRelaunchDestination = 'dashboard' | 'profile' | 'love_setup';

const DESTINATIONS: Record<LoveRelaunchDestination, string> = {
  dashboard: '/dashboard?from=love-relaunch',
  profile: '/profile?from=love-relaunch',
  love_setup: '/quiz?line=love&from=love-relaunch',
};

function secret(): string {
  const value = process.env.MATCH_LINK_SECRET;
  if (!value || value.length < 16) throw new Error('MATCH_LINK_SECRET is not set or too short');
  return value;
}

function signature(userId: string, destination: LoveRelaunchDestination, expiresAt: number): string {
  return createHmac('sha256', secret())
    .update(`${LOVE_RELAUNCH_CAMPAIGN}.${userId}.${destination}.${expiresAt}`)
    .digest('base64url');
}

export function loveRelaunchToken(
  userId: string,
  destination: LoveRelaunchDestination,
  expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000,
): string {
  const exp = Math.floor(expiresAt).toString(36);
  return `${exp}.${signature(userId, destination, expiresAt)}`;
}

export function verifyLoveRelaunchToken(
  userId: string,
  destination: string,
  token: string | null,
): destination is LoveRelaunchDestination {
  if (!token || !(destination in DESTINATIONS)) return false;
  const [encodedExpiry, supplied, extra] = token.split('.');
  const expiresAt = Number.parseInt(encodedExpiry, 36);
  if (!encodedExpiry || !supplied || extra || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = signature(userId, destination as LoveRelaunchDestination, expiresAt);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function loveRelaunchPath(destination: LoveRelaunchDestination): string {
  return DESTINATIONS[destination];
}

export function loveRelaunchUrl(baseUrl: string, userId: string, destination: LoveRelaunchDestination): string {
  const token = loveRelaunchToken(userId, destination);
  const params = new URLSearchParams({ u: userId, d: destination, t: token });
  return `${baseUrl}/api/campaign/love-return?${params.toString()}`;
}
