import "server-only";
import { reportedFriendIds } from '@/lib/friend-report-policy';
import { supabaseAdmin } from "@/lib/supabase";
import { sendPushToUserDetailed, type PushPayload } from "@/lib/push";
import { deliverLoveMessageNotification } from "@/lib/love-message-notification";
import { dateNoticeStillRelevant } from "@/lib/date-plan-notification";

type EntityType =
  | "love_match"
  | "friend_dm"
  | "friend_circle"
  | "friend_club"
  | "friend_plan"
  | "date_plan";

export async function enqueuePushNotification(input: {
  recipientId: string;
  actorId?: string | null;
  entityType: EntityType;
  entityId: string;
  payload: PushPayload;
  dedupeKey: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from("notification_jobs").upsert(
    {
      job_type: "push",
      recipient_id: input.recipientId,
      actor_id: input.actorId || null,
      entity_type: input.entityType,
      entity_id: input.entityId,
      payload: input.payload,
      dedupe_key: input.dedupeKey,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
  if (error)
    console.error("[notification-outbox] push enqueue failed", {
      code: error.code,
    });
  return !error;
}

export async function enqueueLoveMessageNotification(input: {
  matchId: string;
  recipientId: string;
  senderId: string;
  messageId: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from("notification_jobs").upsert(
    {
      job_type: "love_chat_message",
      recipient_id: input.recipientId,
      actor_id: input.senderId,
      entity_type: "love_match",
      entity_id: input.matchId,
      payload: { messageId: input.messageId },
      dedupe_key: `love-chat:${input.messageId}:${input.recipientId}`,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
  if (error)
    console.error("[notification-outbox] Love message enqueue failed", {
      code: error.code,
    });
  return !error;
}

function safeError(error: unknown): string {
  const raw = error instanceof Error ? error.name : "worker_error";
  return raw.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "worker_error";
}

export async function processNotificationOutbox(limit = 25) {
  const { data: jobs, error } = await supabaseAdmin.rpc(
    "claim_notification_jobs",
    { p_limit: limit },
  );
  if (error) throw error;
  const result = {
    claimed: jobs?.length || 0,
    delivered: 0,
    skipped: 0,
    retried: 0,
    dead: 0,
  };
  for (const job of jobs ?? []) {
    try {
      let complete = false;
      let delivered = false;
      let errorCode = "delivery_failed";
      if (job.job_type === "push") {
        if (job.actor_id && job.entity_type?.startsWith('friend_') &&
            (await reportedFriendIds(job.recipient_id)).has(job.actor_id)) {
          const skipped = await supabaseAdmin.rpc('skip_notification_job', {
            p_job_id: job.id, p_reason: 'friend_pair_reported',
          });
          if (skipped.error) throw skipped.error;
          if (skipped.data) result.skipped++;
          continue;
        }
        if (
          job.entity_type === "date_plan" &&
          !(await dateNoticeStillRelevant(job))
        ) {
          const skipped = await supabaseAdmin.rpc("skip_notification_job", {
            p_job_id: job.id,
            p_reason: "date_notice_no_longer_relevant",
          });
          if (skipped.error) throw skipped.error;
          if (skipped.data) result.skipped++;
          continue;
        }
        const delivery = await sendPushToUserDetailed(
          job.recipient_id,
          job.payload as PushPayload,
        );
        complete = !delivery.retryable;
        delivered = delivery.delivered;
        errorCode = delivery.reason;
      } else if (job.job_type === "love_chat_message") {
        if (!job.actor_id || !job.payload?.messageId) {
          const skipped = await supabaseAdmin.rpc("skip_notification_job", {
            p_job_id: job.id,
            p_reason: "invalid_message_job",
          });
          if (skipped.error) throw skipped.error;
          if (skipped.data) result.skipped++;
          continue;
        }
        const delivery = await deliverLoveMessageNotification({
          matchId: job.entity_id,
          recipientId: job.recipient_id,
          senderId: job.actor_id,
          messageId: String(job.payload?.messageId || ""),
        });
        complete = delivery.complete;
        delivered = delivery.delivered === true;
        errorCode = delivery.errorCode || errorCode;
      } else {
        complete = true;
      }
      if (complete) {
        const finished = delivered
          ? await supabaseAdmin.rpc("complete_notification_job", {
              p_job_id: job.id,
            })
          : await supabaseAdmin.rpc("skip_notification_job", {
              p_job_id: job.id,
              p_reason: errorCode,
            });
        if (finished.error) throw finished.error;
        if (finished.data) {
          if (delivered) result.delivered++;
          else result.skipped++;
        }
      } else {
        const { data: status } = await supabaseAdmin.rpc(
          "fail_notification_job",
          { p_job_id: job.id, p_error_code: errorCode },
        );
        if (status === "dead") result.dead++;
        else result.retried++;
      }
    } catch (caught) {
      const { data: status } = await supabaseAdmin.rpc(
        "fail_notification_job",
        { p_job_id: job.id, p_error_code: safeError(caught) },
      );
      if (status === "dead") result.dead++;
      else result.retried++;
    }
  }
  return result;
}
