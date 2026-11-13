import { randomUUID } from 'node:crypto';
import { renderFriendAnnouncementMessage } from './friend-announcement-message';
import { signUnsubToken } from './email';
import { signFriendEventToken } from './friend-event-campaign';
import type { FriendEventToken } from './friend-event-campaign';
import type { FrozenFriendCampaign, FrozenFriendDelivery } from './friend-event-sender';

type VerifiedRecipient = { userId: string; email: string; deliveryId?: string };
type FreezeDependencies = {
  now?: number;
  newDeliveryId?: () => string;
  signUnsubscribe?: (userId: string, expiresAt: number) => string;
  signAttribution?: (payload: FriendEventToken) => string;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const day = 86400000;

/**
 * Build a review artifact only. Callers must independently verify eligibility
 * and provider permissions. No storage, approval, enrollment or send occurs.
 * Inject IDs, clock and signers for fully deterministic/offline preparation.
 * The exact rendered URLs and footer are part of the subsequent content review.
 */
export function freezeFriendAnnouncement(input: {
  campaign: string;
  version: string;
  expires: number;
  recipients: readonly VerifiedRecipient[];
  linkExpires?: number;
  unsubscribeExpires?: number;
}, dependencies: FreezeDependencies = {}): FrozenFriendCampaign {
  const now = dependencies.now ?? Date.now();
  const linkExpires = input.linkExpires ?? input.expires + 30 * day;
  const unsubscribeExpires = input.unsubscribeExpires ?? input.expires + 90 * day;
  if (!/^friend_events_announcement_[a-z0-9_]+$/.test(input.campaign)
      || !/^friend_events_[a-z0-9_]{1,80}$/.test(input.campaign)
      || typeof input.version !== 'string' || !input.version.trim() || input.version.length > 120 || /[\u0000-\u001f\u007f]/.test(input.version)
      || !Number.isSafeInteger(now) || !Number.isSafeInteger(input.expires) || input.expires <= now
      || !Number.isSafeInteger(linkExpires) || linkExpires < input.expires || linkExpires < now + 30 * day
      || !Number.isSafeInteger(unsubscribeExpires) || unsubscribeExpires < linkExpires || unsubscribeExpires < now + 90 * day
      || !Array.isArray(input.recipients) || !input.recipients.length) {
    throw new Error('Invalid announcement freeze parameters');
  }
  const users = new Set<string>(); const emails = new Set<string>(); const deliveries = new Set<string>();
  // Validate the whole audience before signing anything. Never silently dedupe,
  // normalize an approved address, substitute an account, or drop a recipient.
  const recipients = input.recipients.map(recipient => {
    if (!recipient || typeof recipient.userId !== 'string' || !uuid.test(recipient.userId)
        || typeof recipient.email !== 'string' || recipient.email.length > 254
        || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient.email)) throw new Error('Invalid verified recipient');
    const deliveryId = recipient.deliveryId ?? (dependencies.newDeliveryId ?? randomUUID)();
    if (typeof deliveryId !== 'string' || !uuid.test(deliveryId)) throw new Error('Invalid delivery ID');
    const user = recipient.userId.toLowerCase(); const email = recipient.email.toLowerCase(); const delivery = deliveryId.toLowerCase();
    if (users.has(user) || emails.has(email) || deliveries.has(delivery)) throw new Error('Duplicate announcement recipient or delivery ID');
    users.add(user); emails.add(email); deliveries.add(delivery);
    return { userId: recipient.userId, email: recipient.email, deliveryId };
  });
  const signGlobal = dependencies.signUnsubscribe ?? signUnsubToken;
  const signAttribution = dependencies.signAttribution ?? signFriendEventToken;
  const entries: FrozenFriendDelivery[] = recipients.map(recipient => {
    const token = signAttribution({ purpose: 'attribution', userId: recipient.userId, deliveryId: recipient.deliveryId, channel: 'email', expires: linkExpires });
    const globalToken = signGlobal(recipient.userId, unsubscribeExpires);
    if (typeof token !== 'string' || !token || typeof globalToken !== 'string' || !globalToken) throw new Error('Signing returned an invalid token');
    const ctaUrl = `https://notcupid.com/go/friend-events?token=${encodeURIComponent(token)}`;
    const unsubscribeUrl = `https://notcupid.com/unsubscribe?u=${encodeURIComponent(recipient.userId)}&t=${encodeURIComponent(globalToken)}`;
    const email = Object.freeze({ to: recipient.email, ...renderFriendAnnouncementMessage({ ctaUrl, unsubscribeUrl }) });
    return Object.freeze({ deliveryId: recipient.deliveryId, userId: recipient.userId, channel: 'email' as const, email });
  });
  Object.freeze(entries);
  return Object.freeze({ purpose: 'friend_line_announcement', campaign: input.campaign, version: input.version, expires: input.expires, entries });
}
