import { supabaseAdmin } from '@/lib/supabase';

const supported = new Set(['email.sent', 'email.delivered', 'email.opened', 'email.clicked', 'email.delivery_delayed', 'email.failed', 'email.bounced', 'email.complained', 'email.suppressed']);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
// Call only AFTER raw-body provider signature verification, or from a verified
// provider GET for a delivery already present in our own ledger. Never a client event.
export async function recordFriendEventProviderEvent(event: any, eventId: string): Promise<boolean> {
  const data = event?.data;
  const tags = Array.isArray(data?.tags) ? Object.fromEntries(data.tags.filter((tag: any) => typeof tag?.name === 'string' && typeof tag.value === 'string').map((tag: any) => [tag.name, tag.value])) : data?.tags;
  if (!supported.has(event?.type) || !/^friend_events_[a-z0-9_]{1,80}$/.test(tags?.campaign || '') || !uuid.test(tags?.friend_event_delivery_id || '')) return false;
  if (typeof data?.email_id !== 'string' || !data.email_id || data.email_id.length > 200 || typeof eventId !== 'string' || !eventId || eventId.length > 200 || typeof event.created_at !== 'string' || !Number.isFinite(Date.parse(event.created_at))) return false;
  const { data: recorded, error } = await supabaseAdmin.rpc('reconcile_friend_event_email', {
    p_delivery: tags.friend_event_delivery_id, p_campaign: tags.campaign,
    p_provider: data.email_id, p_event_id: eventId, p_type: event.type, p_at: event.created_at,
  });
  if (error) throw new Error('Friend event lifecycle storage failed');
  return recorded === true;
}
