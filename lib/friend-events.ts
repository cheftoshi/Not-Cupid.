import { supabaseAdmin } from '@/lib/supabase';

export type FriendActionEvent =
  | 'discovery_viewed'
  | 'intent_created'
  | 'intent_joined'
  | 'intent_closed'
  | 'community_opened'
  | 'club_joined'
  | 'plan_rsvp';

export async function recordFriendAction(input: {
  userId: string;
  event: FriendActionEvent;
  subjectType?: string | null;
  subjectId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { error } = await supabaseAdmin.from('friend_action_events').insert({
      user_id: input.userId,
      event: input.event,
      subject_type: input.subjectType || null,
      subject_id: input.subjectId || null,
      metadata: input.metadata || {},
    });
    if (error) console.warn('friend action event unavailable', error.message);
  } catch { /* analytics must never block the social action */ }
}
