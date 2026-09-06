import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToUserDetailed, type PushPayload } from '@/lib/push';
import { deliverLoveMessageNotification } from '@/lib/love-message-notification';

type EntityType = 'love_match' | 'friend_dm' | 'friend_circle' | 'friend_club' | 'friend_plan';

export async function enqueuePushNotification(input: {
  recipientId: string;
  actorId?: string | null;
  entityType: EntityType;
  entityId: string;
  payload: PushPayload;
  dedupeKey: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from('notification_jobs').upsert({
    job_type: 'push', recipient_id: input.recipientId, actor_id: input.actorId || null,
    entity_type: input.entityType, entity_id: input.entityId, payload: input.payload,
    dedupe_key: input.dedupeKey,
  }, { onConflict: 'dedupe_key', ignoreDuplicates: true });
  if (error) console.error('[notification-outbox] push enqueue failed', { code: error.code });
  return !error;
}

export async function enqueueLoveMessageNotification(input: {
  matchId: string;
  recipientId: string;
  senderId: string;
  messageId: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from('notification_jobs').upsert({
    job_type: 'love_chat_message', recipient_id: input.recipientId, actor_id: input.senderId,
    entity_type: 'love_match', entity_id: input.matchId,
    payload: { messageId: input.messageId }, dedupe_key: `love-chat:${input.messageId}:${input.recipientId}`,
  }, { onConflict: 'dedupe_key', ignoreDuplicates: true });
  if (error) console.error('[notification-outbox] Love message enqueue failed', { code: error.code });
  return !error;
}

function safeError(error: unknown): string {
  const raw = error instanceof Error ? error.name : 'worker_error';
  return raw.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80) || 'worker_error';
}

export async function processNotificationOutbox(limit = 25) {
  const { data: jobs, error } = await supabaseAdmin.rpc('claim_notification_jobs', { p_limit: limit });
  if (error) throw error;
  const result = { claimed: jobs?.length || 0, delivered: 0, retried: 0, dead: 0 };
  for (const job of jobs ?? []) {
    try {
      let complete = false;
      let errorCode = 'delivery_failed';
      if (job.job_type === 'push') {
        const delivery = await sendPushToUserDetailed(job.recipient_id, job.payload as PushPayload);
        complete = !delivery.retryable;
        errorCode = delivery.reason;
      } else if (job.job_type === 'love_chat_message') {
        if (!job.actor_id || !job.payload?.messageId) {
          await supabaseAdmin.rpc('complete_notification_job', { p_job_id: job.id });
          result.dead++;
          continue;
        }
        const delivery = await deliverLoveMessageNotification({
          matchId: job.entity_id,
          recipientId: job.recipient_id,
          senderId: job.actor_id,
          messageId: String(job.payload?.messageId || ''),
        });
        complete = delivery.complete;
        errorCode = delivery.errorCode || errorCode;
      } else {
        complete = true;
      }
      if (complete) {
        await supabaseAdmin.rpc('complete_notification_job', { p_job_id: job.id });
        result.delivered++;
      } else {
        const { data: status } = await supabaseAdmin.rpc('fail_notification_job', { p_job_id: job.id, p_error_code: errorCode });
        if (status === 'dead') result.dead++;
        else result.retried++;
      }
    } catch (caught) {
      const { data: status } = await supabaseAdmin.rpc('fail_notification_job', { p_job_id: job.id, p_error_code: safeError(caught) });
      if (status === 'dead') result.dead++;
      else result.retried++;
    }
  }
  return result;
}
