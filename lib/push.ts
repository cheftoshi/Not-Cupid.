// Server-side web push. Sends to all of a user's subscribed browsers/devices
// and prunes subscriptions the push service reports as dead (404/410).
//
// Requires env: NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY. Without them
// every send is a silent no-op (one warn) so the app never breaks on missing
// config — same philosophy as the email layer.

import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase';

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.warn('push: VAPID keys missing — push disabled');
    return false;
  }
  webpush.setVapidDetails('mailto:match@notcupid.com', pub, priv);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string; // where a tap takes them (default /dashboard, set in sw.js)
  tag?: string; // same tag collapses stacked notifications (e.g. per-chat)
};

export type PushDeliveryResult = {
  delivered: boolean;
  retryable: boolean;
  reason: string;
};

export async function sendPushToUserDetailed(userId: string, payload: PushPayload): Promise<PushDeliveryResult> {
  try {
    if (!ensureConfigured()) return { delivered: false, retryable: false, reason: 'push_not_configured' };
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);
    if (error) {
      console.error('[push] Could not load subscriptions:', error.message);
      return { delivered: false, retryable: true, reason: 'subscription_lookup_failed' };
    }
    if (!subs || subs.length === 0) return { delivered: false, retryable: false, reason: 'no_subscription' };

    const body = JSON.stringify(payload);
    const outcomes = await Promise.all(subs.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          body,
        );
        return 'delivered' as const;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', subscription.id);
          return 'dead' as const;
        }
        return error?.statusCode === 429 || error?.statusCode >= 500 ? 'retry' as const : 'failed' as const;
      }
    }));
    if (outcomes.includes('delivered')) return { delivered: true, retryable: false, reason: 'delivered' };
    if (outcomes.includes('retry')) return { delivered: false, retryable: true, reason: 'push_provider_retryable' };
    return { delivered: false, retryable: false, reason: 'push_unavailable' };
  } catch (error) {
    console.error('push: send failed', error);
    return { delivered: false, retryable: true, reason: 'push_worker_failed' };
  }
}

/** Send a push to every subscription a user has. Never throws. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<boolean> {
  return (await sendPushToUserDetailed(userId, payload)).delivered;
}
