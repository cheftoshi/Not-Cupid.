import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { renderEmail, sendEmail, button } from "@/lib/email";
import { sendPushToUserDetailed } from "@/lib/push";
import { dailyActivityEmailActivation } from "@/lib/daily-activity-email";
import { pairAllowed } from '@/lib/pair-safety';

const MESSAGE_EMAIL_THROTTLE_MS = 60 * 60 * 1000;

export async function deliverLoveMessageNotification(input: {
  matchId: string;
  recipientId: string;
  senderId: string;
  messageId: string;
}): Promise<{ complete: boolean; delivered?: boolean; errorCode?: string }> {
  const { matchId, recipientId, senderId, messageId } = input;
  const { data: match, error: matchError } = await supabaseAdmin.from('matches')
    .select('user_1_id,user_2_id,ended_at,status,user_1_accepted,user_2_accepted').eq('id', matchId).maybeSingle();
  if (matchError) return { complete: false, errorCode: 'match_safety_lookup_failed' };
  if (!match || match.ended_at || ['ended','passed','expired'].includes(match.status) ||
      !match.user_1_accepted || !match.user_2_accepted || senderId === recipientId ||
      ![match.user_1_id, match.user_2_id].includes(senderId) ||
      ![match.user_1_id, match.user_2_id].includes(recipientId))
    return { complete: true, errorCode: 'conversation_closed' };
  if (!await pairAllowed({ id: recipientId, is_test: false }, senderId))
    return { complete: true, errorCode: 'pair_unavailable' };
  const { data: recipient, error: recipientError } = await supabaseAdmin
    .from("users")
    .select(
      "email, email_notifications, notifications_paused_at, is_test, deleted_at, is_blocked",
    )
    .eq("id", recipientId)
    .single();
  if (recipientError)
    return { complete: false, errorCode: "recipient_lookup_failed" };
  if (!recipient || recipient.is_test === true || recipient.deleted_at || recipient.is_blocked)
    return { complete: true };

  const { data: senderRow, error: senderError } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", senderId)
    .single();
  if (senderError)
    return { complete: false, errorCode: "sender_lookup_failed" };
  const senderFirst = (senderRow?.name || "Your match").split(" ")[0];

  const push = await sendPushToUserDetailed(recipientId, {
    title: `${senderFirst} sent you a message`,
    body: "Open the chat before it goes quiet.",
    url: `/match/${matchId}`,
    tag: `chat-${matchId}`,
  });
  if (push.retryable) return { complete: false, errorCode: push.reason };

  if (
    !recipient.email ||
    recipient.email_notifications === false ||
    recipient.notifications_paused_at
  )
    return {
      complete: true,
      delivered: push.delivered,
      errorCode: push.reason,
    };
  if (dailyActivityEmailActivation().enabled)
    return {
      complete: true,
      delivered: push.delivered,
      errorCode: push.reason,
    };

  const { data: throttle, error: throttleError } = await supabaseAdmin
    .from("match_notifications")
    .select("last_message_email_at")
    .eq("match_id", matchId)
    .eq("recipient_id", recipientId)
    .maybeSingle();
  if (throttleError)
    return { complete: false, errorCode: "email_throttle_lookup_failed" };
  if (
    throttle?.last_message_email_at &&
    Date.now() - new Date(throttle.last_message_email_at).getTime() <
      MESSAGE_EMAIL_THROTTLE_MS
  )
    return {
      complete: true,
      delivered: push.delivered,
      errorCode: push.reason,
    };

  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://notcupid.com";
  const emailResult = await sendEmail({
    to: recipient.email,
    subject: `${senderFirst} sent you a message`,
    html: renderEmail({
      preheader: `${senderFirst} just messaged you on NotCupid.`,
      eyebrow: "new message",
      headline: `${senderFirst} sent you a message.`,
      bodyHtml: `<p style="margin:0 0 18px 0;">Your conversation has a new message. Open it when you’re ready to reply.</p>${button({ href: `${base}/match/${matchId}`, label: "Open the chat →" })}`,
    }),
    idempotencyKey: `chat-message-${matchId}-${recipientId}-${messageId}`,
  });
  if (!emailResult.ok)
    return { complete: false, errorCode: "email_provider_failed" };

  const { error: throttleWriteError } = await supabaseAdmin
    .from("match_notifications")
    .upsert(
      {
        match_id: matchId,
        recipient_id: recipientId,
        last_message_email_at: new Date().toISOString(),
      },
      { onConflict: "match_id,recipient_id" },
    );
  return throttleWriteError
    ? { complete: false, errorCode: "email_throttle_write_failed" }
    : { complete: true, delivered: true };
}
