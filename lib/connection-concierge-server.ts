import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { liveMatchesFor } from '@/lib/match-actions';
import { friendLocationContext, friendMetroLabel } from '@/lib/friend-location';
import { isLgbtqIdentity } from '@/lib/friend-matching';
import { profileReadiness } from '@/lib/profile-readiness';
import type { ConciergeInventory } from '@/lib/connection-concierge';

function firstName(value: unknown): string {
  return (typeof value === 'string' && value.trim() ? value.trim() : 'someone').split(' ')[0].slice(0, 28);
}
function planWhen(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
}

export async function connectionConciergeInventory(user: any): Promise<ConciergeInventory> {
  const nowIso = new Date().toISOString();
  const meTest = user.is_test === true;
  const location = await friendLocationContext(user);
  const city = friendMetroLabel(location.metro)?.split(',')[0] || 'your city';

  const [liveLove, activitiesResult, friendConnectionsResult] = await Promise.all([
    liveMatchesFor(user.id),
    supabaseAdmin.from('friend_activities')
      .select('id, author_id, title, category, area, happens_at, audience_gender, audience_age_min, audience_age_max, capacity, metro, kind')
      .eq('is_test', meTest)
      .eq('kind', 'event')
      .gt('happens_at', nowIso)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('happens_at', { ascending: true })
      .limit(24),
    supabaseAdmin.from('friend_connections')
      .select('user_a_id, user_b_id, status, opened_at')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .neq('status', 'declined')
      .limit(80),
  ]);
  if (activitiesResult.error) throw activitiesResult.error;
  if (friendConnectionsResult.error) throw friendConnectionsResult.error;

  const activityRows = (activitiesResult.data || []).filter((activity: any) => {
    if (activity.author_id === user.id) return false;
    if (location.metro && activity.metro && activity.metro !== location.metro) return false;
    const audience = Array.isArray(activity.audience_gender) ? activity.audience_gender : [];
    if (audience.length && !audience.includes(user.gender) && !(audience.includes('lgbtq') && isLgbtqIdentity(user))) return false;
    if (activity.audience_age_min != null && (user.age == null || user.age < activity.audience_age_min)) return false;
    if (activity.audience_age_max != null && (user.age == null || user.age > activity.audience_age_max)) return false;
    return true;
  });
  const activityIds = activityRows.map((activity: any) => activity.id);
  const { data: myRsvps } = activityIds.length
    ? await supabaseAdmin.from('friend_activity_rsvps').select('activity_id, response').eq('user_id', user.id).in('activity_id', activityIds)
    : { data: [] as any[] };
  const alreadyIn = new Set((myRsvps || []).filter((row: any) => row.response === 'yes').map((row: any) => row.activity_id));
  const candidateActivities = activityRows.filter((activity: any) => !alreadyIn.has(activity.id));
  const joinableIds = candidateActivities.map((activity: any) => activity.id);
  const { data: rsvpRows } = joinableIds.length
    ? await supabaseAdmin.from('friend_activity_rsvps').select('activity_id, response').in('activity_id', joinableIds).eq('response', 'yes').limit(1000)
    : { data: [] as any[] };
  const goingByPlan = new Map<string, number>();
  for (const row of rsvpRows || []) goingByPlan.set(row.activity_id, (goingByPlan.get(row.activity_id) || 0) + 1);
  const joinableActivities = candidateActivities
    .filter((activity: any) => activity.capacity == null || (goingByPlan.get(activity.id) || 0) < activity.capacity)
    .slice(0, 8);

  const friendConnections = friendConnectionsResult.data || [];
  const connected = friendConnections.filter((connection: any) => connection.status === 'connected');
  const friendIds = connected.map((connection: any) => connection.user_a_id === user.id ? connection.user_b_id : connection.user_a_id);
  const loveIds = liveLove.map((match: any) => match.user_1_id === user.id ? match.user_2_id : match.user_1_id);
  const personIds = Array.from(new Set([...friendIds, ...loveIds]));
  const { data: people } = personIds.length
    ? await supabaseAdmin.from('users').select('id, name, is_test').in('id', personIds)
    : { data: [] as any[] };
  const peopleById = new Map((people || []).filter((person: any) => (person.is_test === true) === meTest).map((person: any) => [person.id, person]));

  const readiness = profileReadiness(user);
  const love = liveLove.flatMap((match: any) => {
    const otherId = match.user_1_id === user.id ? match.user_2_id : match.user_1_id;
    const other: any = peopleById.get(otherId);
    if (!other) return [];
    const iAccepted = match.user_1_id === user.id ? match.user_1_accepted : match.user_2_accepted;
    const theyAccepted = match.user_1_id === user.id ? match.user_2_accepted : match.user_1_accepted;
    return [{
      id: match.id,
      name: firstName(other.name),
      state: (iAccepted && theyAccepted ? 'chat_open' : !iAccepted && theyAccepted ? 'needs_answer' : 'waiting') as 'chat_open' | 'needs_answer' | 'waiting',
    }];
  });

  const friends = friendIds.flatMap((id: string) => {
    const person: any = peopleById.get(id);
    return person ? [{ id, name: firstName(person.name) }] : [];
  }).slice(0, 8);

  return {
    firstName: firstName(user.name),
    city,
    archetype: typeof user.archetype === 'string' ? user.archetype.slice(0, 80) : null,
    interests: [...(user.music || []), ...(user.food || []), ...(user.hobbies || []), ...(user.sports || [])]
      .filter((value: unknown): value is string => typeof value === 'string' && !!value.trim()).slice(0, 12),
    profileReady: readiness.coreReady,
    hasArchetype: !!user.archetype,
    needsLoveDeep: !!user.archetype && !user.attach_style,
    friendOptedIn: !!user.friend_opted_in_at,
    isTraveling: location.isTraveling,
    sealedFriendCount: friendConnections.filter((connection: any) => connection.status !== 'connected' && connection.opened_at == null).length,
    love,
    friends,
    plans: joinableActivities.map((activity: any) => ({
      id: activity.id,
      title: String(activity.title || 'local plan').slice(0, 100),
      category: activity.category ? String(activity.category).slice(0, 30) : null,
      area: activity.area ? String(activity.area).slice(0, 60) : null,
      when: planWhen(activity.happens_at),
      going: goingByPlan.get(activity.id) || 0,
    })),
  };
}
