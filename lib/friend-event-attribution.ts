import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { recordAppEvent } from '@/lib/app-events';
import { OUTSIDE_ID_RE, SESSION_RE } from '@/lib/outside-event-tracking';
import { FRIEND_EVENT_COOKIE, verifyFriendEventToken } from '@/lib/friend-event-campaign';

// Only a signed touch owned by this member and an accepted delivery within seven days.
// A query-string campaign name, forwarded link or bot request is not attribution.
export async function friendEventCampaignContext(userId: string) {
  try {
    const token = (await cookies()).get(FRIEND_EVENT_COOKIE)?.value;
    const claim = verifyFriendEventToken(token, 'attribution');
    if (!claim || claim.userId !== userId || !claim.deliveryId) return null;
    const { data, error } = await supabaseAdmin.from('friend_event_deliveries').select('id').eq('id', claim.deliveryId).eq('user_id', userId).eq('channel', claim.channel).in('status', ['accepted', 'delivered']).gte('claimed_at', new Date(Date.now() - 7 * 86400000).toISOString()).maybeSingle();
    return error || !data ? null : claim;
  } catch { return null; }
}

export async function recordFriendEventConversion(userId: string, event: 'authenticated_return' | 'plan_join' | 'plan_create', outside?: { eventId: string; planId: string; sessionId?: unknown }) {
  try {
    const claim = await friendEventCampaignContext(userId);
    // These outcomes are called only after the existing server action succeeds.
    // Count unique member/plan outcomes, never attempts or repeated RSVP toggles.
    if (outside && OUTSIDE_ID_RE.test(outside.eventId) && SESSION_RE.test(outside.planId) && event !== 'authenticated_return') {
      const key = createHash('sha256').update(JSON.stringify([userId,event,outside.planId])).digest('hex');
      await recordAppEvent({userId,eventName:`outside_event_${event}`,surface:'outside_events',path:'/hub',sessionId:typeof outside.sessionId === 'string' && SESSION_RE.test(outside.sessionId) ? outside.sessionId : null,dedupeKey:`outside-outcome:${key}`,metadata:{event_id:outside.eventId,plan_id:outside.planId,campaign_delivery_id:claim?.deliveryId || null,campaign_channel:claim?.channel || null}});
    }
    if (!claim?.deliveryId) return;
    await supabaseAdmin.from('friend_event_attribution').upsert({ delivery_id: claim.deliveryId, event }, { onConflict: 'delivery_id,event', ignoreDuplicates: true });
  } catch { /* Analytics must never break navigation or a real plan action. */ }
}
