import { supabaseAdmin } from '@/lib/supabase';
import { metroOf } from '@/lib/quiz-data';
import { friendLocationContext } from '@/lib/friend-location';

type FriendActivityAccessRow = {
  id: string;
  author_id: string;
  metro?: string | null;
  is_test?: boolean | null;
};

export async function friendActivityInCurrentMetro(user: any, activity: FriendActivityAccessRow): Promise<boolean> {
  if ((activity.is_test === true) !== (user.is_test === true)) return false;
  if (activity.author_id === user.id) return true;
  const location = await friendLocationContext(user);
  if (!location.metro) return true;
  if (activity.metro) return activity.metro === location.metro;

  // Legacy Scene rows predate the denormalized metro field. Verify those by
  // author rather than treating null as globally visible.
  const { data: author } = await supabaseAdmin.from('users').select('zip, is_test').eq('id', activity.author_id).maybeSingle();
  return !!author && (author.is_test === true) === (user.is_test === true) && metroOf(author.zip) === location.metro;
}

export async function hasFriendActivityHistory(userId: string, activityId: string): Promise<boolean> {
  const [rsvp, comment] = await Promise.all([
    supabaseAdmin.from('friend_activity_rsvps').select('response').eq('activity_id', activityId).eq('user_id', userId).in('response', ['yes', 'maybe']).limit(1).maybeSingle(),
    supabaseAdmin.from('friend_activity_comments').select('id').eq('activity_id', activityId).eq('user_id', userId).limit(1).maybeSingle(),
  ]);
  return !!rsvp.data || !!comment.data;
}
