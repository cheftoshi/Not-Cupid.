import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { FRIEND_EVENT_COOKIE, verifyFriendEventToken } from '@/lib/friend-event-campaign';

// Last signed touch within seven days of the delivery claim. Owner only; forwarded links
// and bots can produce link_request, never another member's conversion.
export async function recordFriendEventConversion(userId: string, event: 'authenticated_return' | 'plan_join' | 'plan_create') {
  try {
    const token = (await cookies()).get(FRIEND_EVENT_COOKIE)?.value;
    const claim = verifyFriendEventToken(token, 'attribution');
    if (!claim || claim.userId !== userId || !claim.deliveryId) return;
    const { data, error } = await supabaseAdmin.from('friend_event_deliveries').select('id').eq('id', claim.deliveryId).eq('user_id', userId).eq('channel', claim.channel).in('status', ['accepted', 'delivered']).gte('claimed_at', new Date(Date.now() - 7 * 86400000).toISOString()).maybeSingle();
    if (error || !data) return;
    await supabaseAdmin.from('friend_event_attribution').upsert({ delivery_id: claim.deliveryId, event }, { onConflict: 'delivery_id,event', ignoreDuplicates: true });
  } catch { /* Analytics must never break navigation or a real plan action. */ }
}
