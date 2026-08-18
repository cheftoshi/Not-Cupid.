import { supabaseAdmin } from '@/lib/supabase';

export type LoveNotificationType =
  | 'interest_immediate'
  | 'decision_24h'
  | 'decision_final'
  | 'mutual'
  | 'mutual_no_message_12h'
  | 'expired';

export type LoveNotificationChannel = 'email' | 'push' | 'in_app';
export type LoveDecision = 'accepted' | 'passed' | 'expired';

type ProviderResult = { ok: boolean; id?: string; error?: unknown };

function safeErrorCode(error: unknown): string {
  const raw = error instanceof Error ? error.name : typeof error === 'string' ? error : 'provider_error';
  return raw.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80) || 'provider_error';
}

/**
 * Atomically claims one channel delivery. A null result means another request
 * or cron tick already owns/sent it, so callers must not contact the provider.
 */
export async function claimLoveNotificationEvent(args: {
  matchId: string;
  recipientId: string;
  type: LoveNotificationType;
  channel: LoveNotificationChannel;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc('claim_love_notification_event', {
    p_match_id: args.matchId,
    p_recipient_id: args.recipientId,
    p_notification_type: args.type,
    p_channel: args.channel,
  });
  if (error) {
    console.error('[love-ledger] claim failed', { type: args.type, channel: args.channel, code: error.code });
    return null;
  }
  return typeof data === 'string' ? data : null;
}

export async function markLoveNotificationResult(
  eventIds: string[],
  result: ProviderResult,
): Promise<void> {
  if (eventIds.length === 0) return;
  const at = new Date().toISOString();
  const update = result.ok
    ? {
        status: 'sent',
        sent_at: at,
        last_event_at: at,
        provider_id: result.id || null,
        error_code: null,
      }
    : {
        status: 'failed',
        failed_at: at,
        last_event_at: at,
        error_code: safeErrorCode(result.error),
      };
  const { error } = await supabaseAdmin
    .from('love_notification_events')
    .update(update)
    .in('id', eventIds);
  if (error) console.error('[love-ledger] result update failed', { code: error.code });
}

export async function markLoveNotificationSkipped(eventIds: string[], reason: string): Promise<void> {
  if (eventIds.length === 0) return;
  const at = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('love_notification_events')
    .update({
      status: 'skipped',
      last_event_at: at,
      error_code: safeErrorCode(reason),
    })
    .in('id', eventIds);
  if (error) console.error('[love-ledger] skip update failed', { code: error.code });
}

export async function recordLoveDecision(
  matchId: string,
  recipientId: string,
  response: LoveDecision,
): Promise<void> {
  const at = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('love_notification_events')
    .update({ responded_at: at, response, last_event_at: at })
    .eq('match_id', matchId)
    .eq('recipient_id', recipientId);
  if (error) console.error('[love-ledger] decision update failed', { response, code: error.code });
}

export async function recordLoveExpiry(matchId: string, recipientIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(recipientIds.filter(Boolean)));
  const at = new Date().toISOString();
  await Promise.all(uniqueIds.map(async (recipientId) => {
    await recordLoveDecision(matchId, recipientId, 'expired');
    const eventId = await claimLoveNotificationEvent({
      matchId,
      recipientId,
      type: 'expired',
      channel: 'in_app',
    });
    if (!eventId) return;
    const { error } = await supabaseAdmin
      .from('love_notification_events')
      .update({
        status: 'recorded',
        responded_at: at,
        response: 'expired',
        last_event_at: at,
      })
      .eq('id', eventId);
    if (error) console.error('[love-ledger] expiry update failed', { code: error.code });
  }));
}

/** Mark an authenticated PWA/dashboard deep-link open without trusting a UUID alone. */
export async function markLoveNotificationOpened(eventId: string, recipientId: string): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(eventId)) return;
  const at = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('love_notification_events')
    .update({ status: 'clicked', clicked_at: at, last_event_at: at })
    .eq('id', eventId)
    .eq('recipient_id', recipientId)
    .eq('channel', 'push');
  if (error) console.error('[love-ledger] PWA click update failed', { code: error.code });
}

export function loveDashboardUrl(matchId: string, eventId?: string | null): string {
  const params = new URLSearchParams({ focus: matchId });
  if (eventId) params.set('love_event', eventId);
  return `/dashboard?${params.toString()}#connections`;
}
