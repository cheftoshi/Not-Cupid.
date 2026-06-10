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

/** Send a push to every subscription a user has. Never throws. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);
    // Pre-migration (table missing) or query error → quiet no-op.
    if (error || !subs || subs.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err: any) {
          // 404/410 = subscription expired or revoked — clean it up.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', s.id);
          }
        }
      })
    );
  } catch (err) {
    console.error('push: send failed', err);
  }
}
