import { supabaseAdmin } from '@/lib/supabase';

export type MonetizationEvent =
  | 'paywall_viewed'
  | 'checkout_started'
  | 'checkout_failed'
  | 'purchase_completed';

export type MonetizationProduct = 'love_profile' | 'friend_pack' | 'pro';

// Revenue instrumentation must never block the user or payment fulfillment.
export async function recordMonetizationEvent(input: {
  userId: string;
  event: MonetizationEvent;
  product: MonetizationProduct;
  surface: string;
  matchId?: string | null;
  amountCents?: number | null;
  externalEventId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('monetization_events').insert({
      user_id: input.userId,
      event: input.event,
      product: input.product,
      surface: input.surface.slice(0, 80),
      match_id: input.matchId ?? null,
      amount_cents: input.amountCents ?? null,
      external_event_id: input.externalEventId?.slice(0, 255) ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) console.error('recordMonetizationEvent failed:', error.message);
  } catch (error) {
    console.error('recordMonetizationEvent failed:', error instanceof Error ? error.message : 'unknown error');
  }
}
