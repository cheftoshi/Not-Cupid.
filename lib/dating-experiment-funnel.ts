import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { LOVE_RELAUNCH_CAMPAIGN } from '@/lib/love-relaunch';

export const DATING_EXPERIMENT_FUNNEL_EVENTS = [
  'email_clicked',
  'profile_started',
  'profile_saved',
  'profile_eligible',
  'experiment_viewed',
  'entry_submitted',
] as const;

export type DatingExperimentFunnelEvent = typeof DATING_EXPERIMENT_FUNNEL_EVENTS[number];

// Only campaign recipients belong in this cohort. The unique database key makes
// client retries, repeat saves, and React development replays idempotent.
export async function recordDatingExperimentFunnelEvent(
  userId: string,
  event: DatingExperimentFunnelEvent,
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  const { data: delivery, error: deliveryError } = await supabaseAdmin
    .from('email_campaign_deliveries')
    .select('variant')
    .eq('campaign_key', LOVE_RELAUNCH_CAMPAIGN)
    .eq('user_id', userId)
    .maybeSingle();
  if (deliveryError || !delivery) return false;

  const { error } = await supabaseAdmin
    .from('campaign_funnel_events')
    .upsert({
      campaign_key: LOVE_RELAUNCH_CAMPAIGN,
      user_id: userId,
      variant: delivery.variant,
      event,
      metadata,
    }, {
      onConflict: 'campaign_key,user_id,event',
      ignoreDuplicates: true,
    });
  if (error) {
    console.error('[dating-experiment-funnel]', event, error.message);
    return false;
  }
  return true;
}
