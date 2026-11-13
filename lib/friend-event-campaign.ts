import { createHmac, timingSafeEqual } from 'node:crypto';

export const FRIEND_EVENT_CONSENT_VERSION = 'friend-events-v1';
export const FRIEND_EVENT_COOKIE = 'nc_friend_event_touch';
export type FriendEventToken = {
  purpose: 'unsubscribe' | 'attribution';
  userId: string;
  channel: 'email' | 'push';
  deliveryId?: string;
  expires: number;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function valid(p: FriendEventToken): boolean {
  return !!p && uuid.test(p.userId) && ['email', 'push'].includes(p.channel)
    && ['unsubscribe', 'attribution'].includes(p.purpose)
    && Number.isSafeInteger(p.expires)
    && (p.purpose !== 'attribution' || (typeof p.deliveryId === 'string' && uuid.test(p.deliveryId)));
}
function signingKey(key = process.env.FRIEND_EVENT_SIGNING_SECRET): string {
  if (!key || key.length < 32) throw new Error('Friend event signing is not configured');
  return key;
}
export function signFriendEventToken(payload: FriendEventToken, key?: string): string {
  if (!valid(payload)) throw new Error('Invalid friend event token');
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${createHmac('sha256', signingKey(key)).update(data).digest('base64url')}`;
}
export function verifyFriendEventToken(token: unknown, purpose: FriendEventToken['purpose'], now = Date.now(), key?: string): FriendEventToken | null {
  try {
    if (typeof token !== 'string' || token.length > 1500) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const expected = createHmac('sha256', signingKey(key)).update(parts[0]).digest('base64url');
    const a = Buffer.from(parts[1]); const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as FriendEventToken;
    return valid(payload) && payload.purpose === purpose && payload.expires > now ? payload : null;
  } catch { return null; }
}
// There is deliberately no sender, scheduler or activation toggle in this module.
