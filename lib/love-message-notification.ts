import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { renderEmail, sendEmail, button } from '@/lib/email';
import { sendPushToUserDetailed } from '@/lib/push';
import { dailyActivityEmailActivation } from '@/lib/daily-activity-email';

const MESSAGE_EMAIL_THROTTLE_MS = 60 * 60 * 1000;

export async function deliverLoveMessageNotification(input: {
  matchId: string;
  recipientId: string;
  senderId: string;
  messageId: string;
}): Promise<{ complete: boolean; errorCode?: string }> {
  const { matchId, recipientId, senderId, messageId } = input;
  const { data: recipient, error: recipientError } = await supabaseAdmin
    .from('users').select('email, email_notifications, notifications_paused_at, is_test, deleted_at').eq('id', recipientId).single();
  if (recipientError) return { complete: false, errorCode: 'recipient_lookup_failed' };
  if (!recipient || recipient.is_test === true || recipient.deleted_at) return { complete: true };

  const { data: senderRow, error: senderError } = await supabaseAdmin.from('users').select('name').eq('id', senderId).single();
  if (senderError) return { complete: false, errorCode: 'sender_lookup_failed' };
  const senderFirst = (senderRow?.name || 'Your match').split(' ')[0];

  const push = await sendPushToUserDetailed(recipientId, {
    title: `${senderFirst} sent you a message`,
    body: 'Open the chat before it goes quiet.',
    url: `/match/${matchId}`,
    tag: `chat-${matchId}`,
  });
  if (push.retryable) return { complete: false, errorCode: push.reason };

  if (!recipient.email || recipient.email_notifications === false || recipient.notifications_paused_at) return { complete: true };
  if (dailyActivityEmailActivation().enabled) return { complete: true };

  const { data: throttle, error: throttleError } = await supabaseAdmin
    .from('match_notifications')
    .select('last_message_email_at')
    .eq('match_id', matchId).eq('recipient_id', recipientId)
    .maybeSingle();
  if (throttleError) return { complete: false, errorCode: 'email_throttle_lookup_failed' };
  if (throttle?.last_message_email_at
    && Date.now() - new Date(throttle.last_message_email_at).getTime() < MESSAGE_EMAIL_THROTTLE_MS) return { complete: true };

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://notcupid.com';
  const emailResult = await sendEmail({
    to: recipient.email,
    subject: `${senderFirst} sent you a message`,
    html: renderEmail({
      preheader: `${senderFirst} just messaged you on NotCupid.`,
      eyebrow: 'new message',
      headline: `${senderFirst} sent you a message.`,
      bodyHtml: `<p style="margin:0 0 18px 0;">Don't leave them hanging — the chat goes quiet after 36h of silence.</p>${button({ href: `${base}/match/${matchId}`, label: 'Open the chat →' })}`,
    }),
    idempotencyKey: `chat-message-${matchId}-${recipientId}-${messageId}`,
  });
  if (!emailResult.ok) return { complete: false, errorCode: 'email_provider_failed' };

  const { error: throttleWriteError } = await supabaseAdmin.from('match_notifications').upsert(
    { match_id: matchId, recipient_id: recipientId, last_message_email_at: new Date().toISOString() },
    { onConflict: 'match_id,recipient_id' },
  );
  return throttleWriteError
    ? { complete: false, errorCode: 'email_throttle_write_failed' }
    : { complete: true };
}
