import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { LOVE_RELAUNCH_CAMPAIGN } from '@/lib/love-relaunch';
import { ELIGIBLE_READY_REMINDER_CAMPAIGN } from '@/lib/eligible-ready-reminder';

export const DATING_EXPERIMENT_FUNNEL_EVENTS = [
  'email_clicked',
  'profile_started',
  'profile_saved',
  'profile_eligible',
  'experiment_viewed',
  'rules_continued',
  'preferences_completed',
  'schedule_selected',
  'questionnaire_completed',
  'consent_completed',
  'entry_submit_attempted',
  'entry_submit_failed',
  'entry_submitted',
] as const;

export type DatingExperimentFunnelEvent = typeof DATING_EXPERIMENT_FUNNEL_EVENTS[number];

// Only campaign recipients belong in these cohorts. A person who received the
// original comeback and the later profile-ready reminder is attributed to both
// sends; the database uniqueness key keeps retries and React replays idempotent.
export async function recordDatingExperimentFunnelEvent(
  userId: string,
  event: DatingExperimentFunnelEvent,
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  const { data: deliveries, error: deliveryError } = await supabaseAdmin
    .from('email_campaign_deliveries')
    .select('campaign_key,variant')
    .in('campaign_key', [LOVE_RELAUNCH_CAMPAIGN, ELIGIBLE_READY_REMINDER_CAMPAIGN])
    .eq('user_id', userId)
    .not('sent_at', 'is', null);
  if (deliveryError || !deliveries?.length) return false;

  const { error } = await supabaseAdmin
    .from('campaign_funnel_events')
    .upsert(deliveries.map((delivery) => ({
      campaign_key: delivery.campaign_key,
      user_id: userId,
      variant: delivery.variant,
      event,
      metadata,
    })), {
      onConflict: 'campaign_key,user_id,event',
      ignoreDuplicates: true,
    });
  if (error) {
    console.error('[dating-experiment-funnel]', event, error.message);
    return false;
  }
  return true;
}
