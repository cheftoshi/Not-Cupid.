import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { metroOf } from '@/lib/quiz-data';
import { neighborhoodOf } from '@/lib/neighborhoods';
import { rateLimit } from '@/lib/rate-limit';
import { sendPushToUser } from '@/lib/push';
import { rankFriendDiscovery, type FriendDiscoveryItem } from '@/lib/friend-discovery';
import {
  FRIEND_ACTIVITIES,
  friendActivity,
  friendActivityAffinity,
  friendIntentExpiry,
  friendSceneCategory,
  isFriendTimeWindow,
  normalizeFriendActivity,
  type FriendActivityKey,
} from '@/lib/friend-taxonomy';
import { recordFriendAction } from '@/lib/friend-events';

export const dynamic = 'force-dynamic';

const validActivity = (value: unknown): value is FriendActivityKey =>
  typeof value === 'string' && FRIEND_ACTIVITIES.some((activity) => activity.key === value);

const memberCounts = (rows: any[], key: string) => {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) || 0) + 1);
  return counts;
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join the Friend Line first.' }, { status: 400 });

  const nowIso = new Date().toISOString();
  const isTest = (user as any).is_test === true;
  const metro = metroOf((user as any).zip);
  const area = neighborhoodOf((user as any).zip);
  const requested = req.nextUrl.searchParams.get('activity');
  const affinities = friendActivityAffinity((user as any).friend_vibes);

  let intentQuery = supabaseAdmin.from('friend_intents').select('*')
    .eq('is_test', isTest).eq('status', 'open').gt('expires_at', nowIso)
    .neq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  let clubQuery = supabaseAdmin.from('friend_clubs').select('*')
    .eq('is_test', isTest).is('hidden_at', null).order('last_active_at', { ascending: false }).limit(50);
  let linkQuery = supabaseAdmin.from('friend_community_links').select('*')
    .eq('is_test', isTest).eq('approved', true).order('last_verified_at', { ascending: false, nullsFirst: false }).limit(50);
  let activityQuery = supabaseAdmin.from('friend_activities').select('*')
    .eq('is_test', isTest).eq('kind', 'event')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: false }).limit(60);
  if (metro) {
    intentQuery = intentQuery.eq('metro', metro);
    clubQuery = clubQuery.eq('metro', metro);
    linkQuery = linkQuery.eq('metro', metro);
    // Legacy Scene rows predate denormalized metro. They are admitted only long
    // enough to verify their author's metro below.
    activityQuery = activityQuery.or(`metro.eq.${metro},metro.is.null`);
  }

  const [myIntentRes, intentsRes, clubsRes, linksRes, activitiesRes] = await Promise.all([
    supabaseAdmin.from('friend_intents').select('*').eq('user_id', user.id)
      .eq('status', 'open').gt('expires_at', nowIso).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    intentQuery,
    clubQuery,
    linkQuery,
    activityQuery,
  ]);

  const intents = intentsRes.data || [];
  const clubs = clubsRes.data || [];
  const links = linksRes.data || [];
  const rawActivities = activitiesRes.data || [];
  const intentIds = [...intents.map((intent: any) => intent.id), ...(myIntentRes.data ? [myIntentRes.data.id] : [])];
  const authorIds = Array.from(new Set([
    ...intents.map((intent: any) => intent.user_id),
    ...rawActivities.map((activity: any) => activity.author_id),
  ]));
  const clubIds = clubs.map((club: any) => club.id);
  const activityIds = rawActivities.map((activity: any) => activity.id);

  const [authorsRes, intentMembersRes, clubMembersRes, rsvpsRes] = await Promise.all([
    authorIds.length
      ? supabaseAdmin.from('users').select('id, name, photo_url, zip, is_test').in('id', authorIds)
      : Promise.resolve({ data: [] as any[] }),
    intentIds.length
      ? supabaseAdmin.from('friend_intent_members').select('intent_id, user_id').in('intent_id', intentIds)
      : Promise.resolve({ data: [] as any[] }),
    clubIds.length
      ? supabaseAdmin.from('friend_club_members').select('club_id, user_id, status').in('club_id', clubIds)
      : Promise.resolve({ data: [] as any[] }),
    activityIds.length
      ? supabaseAdmin.from('friend_activity_rsvps').select('activity_id, user_id, response').in('activity_id', activityIds).in('response', ['yes', 'maybe'])
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const authors = new Map((authorsRes.data || []).map((author: any) => [author.id, author]));
  const intentCounts = memberCounts(intentMembersRes.data || [], 'intent_id');
  const approvedClubMembers = (clubMembersRes.data || []).filter((member: any) => member.status === 'member');
  const clubCounts = memberCounts(approvedClubMembers, 'club_id');
  const rsvpCounts = memberCounts(rsvpsRes.data || [], 'activity_id');
  const myJoinedIntentIds = new Set(
    (intentMembersRes.data || []).filter((member: any) => member.user_id === user.id).map((member: any) => member.intent_id)
  );
  const myClubStatus = new Map(
    (clubMembersRes.data || []).filter((member: any) => member.user_id === user.id).map((member: any) => [member.club_id, member.status])
  );

  const activities = rawActivities.filter((activity: any) => {
    const author: any = authors.get(activity.author_id);
    if (!author || (author.is_test === true) !== isTest) return false;
    return !metro || activity.metro === metro || (!activity.metro && metroOf(author.zip) === metro);
  });

  const selected = validActivity(requested)
    ? requested
    : (myIntentRes.data?.activity_key as FriendActivityKey | undefined) || affinities[0] || null;

  const rawRoutes: Array<FriendDiscoveryItem & Record<string, any>> = [
    ...activities.map((activity: any) => {
      const author: any = authors.get(activity.author_id) || {};
      return {
        id: activity.id,
        kind: 'event' as const,
        title: activity.title,
        body: activity.body,
        activityKey: normalizeFriendActivity(activity.category),
        area: activity.area,
        happensAt: activity.happens_at,
        createdAt: activity.created_at,
        memberCount: rsvpCounts.get(activity.id) || 0,
        authorName: String(author.name || 'someone').split(' ')[0],
      };
    }),
    ...clubs.map((club: any) => ({
      id: club.id,
      kind: 'club' as const,
      title: club.name,
      body: club.description,
      activityKey: normalizeFriendActivity(club.activity_key || club.category),
      area: club.area,
      cadence: club.cadence,
      happensAt: club.next_meet_at,
      createdAt: club.created_at,
      memberCount: clubCounts.get(club.id) || 0,
      joinMode: club.join_mode || 'request',
      membershipStatus: club.creator_id === user.id ? 'owner' : (myClubStatus.get(club.id) || null),
      joined: club.creator_id === user.id || myClubStatus.get(club.id) === 'member',
    })),
    ...links.map((link: any) => ({
      id: link.id,
      kind: 'community' as const,
      title: link.title,
      body: link.description,
      activityKey: normalizeFriendActivity(link.activity_key),
      area: link.area,
      cadence: link.cadence,
      verifiedAt: link.last_verified_at,
      createdAt: link.created_at,
      joinCount: link.join_count || 0,
      provider: link.kind,
      url: link.url,
      audience: link.audience,
    })),
    ...intents.map((intent: any) => {
      const author: any = authors.get(intent.user_id) || {};
      return {
        id: intent.id,
        kind: 'intent' as const,
        title: `${String(author.name || 'someone').split(' ')[0]} is down for ${friendActivity(intent.activity_key).label}`,
        body: intent.note,
        activityKey: intent.activity_key,
        area: intent.area,
        timeWindow: intent.time_window,
        createdAt: intent.created_at,
        memberCount: 1 + (intentCounts.get(intent.id) || 0),
        authorName: String(author.name || 'someone').split(' ')[0],
        authorPhoto: author.photo_url || null,
        joined: myJoinedIntentIds.has(intent.id),
      };
    }),
  ];

  const routes = rankFriendDiscovery(rawRoutes, { selected, affinities, area }).slice(0, 18);
  const myIntent = myIntentRes.data ? {
    id: myIntentRes.data.id,
    activityKey: myIntentRes.data.activity_key,
    activity: friendActivity(myIntentRes.data.activity_key),
    timeWindow: myIntentRes.data.time_window,
    note: myIntentRes.data.note,
    expiresAt: myIntentRes.data.expires_at,
    interestedCount: intentCounts.get(myIntentRes.data.id) || 0,
  } : null;

  await recordFriendAction({
    userId: user.id,
    event: 'discovery_viewed',
    subjectType: selected ? 'activity' : null,
    subjectId: selected,
    metadata: { routeCount: routes.length },
  });

  return NextResponse.json({
    selected,
    affinities,
    myIntent,
    routes,
    counts: {
      plans: routes.filter((route) => route.kind === 'event').length,
      clubs: routes.filter((route) => route.kind === 'club').length,
      communities: routes.filter((route) => route.kind === 'community').length,
      people: routes.filter((route) => route.kind === 'intent').length,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join the Friend Line first.' }, { status: 400 });
  const limit = await rateLimit({ key: `friend-discover:${user.id}`, windowSec: 3600, maxAttempts: 40, blockSec: 1800 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many actions — give it a minute.' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const isTest = (user as any).is_test === true;
  const metro = metroOf((user as any).zip);

  if (action === 'set_intent') {
    if (!validActivity(body.activityKey)) return NextResponse.json({ error: 'Pick what you want to do.' }, { status: 400 });
    const timeWindow = isFriendTimeWindow(body.timeWindow) ? body.timeWindow : 'this_week';
    const role = ['join', 'host', 'either'].includes(body.role) ? body.role : 'either';
    const groupSize = ['one', 'small', 'group'].includes(body.groupSize) ? body.groupSize : 'small';
    const note = String(body.note || '').trim().slice(0, 180) || null;
    const area = String(body.area || '').trim().slice(0, 60) || neighborhoodOf((user as any).zip);

    // A person has one current ask. Replacing it is more legible to other people
    // than leaving several stale versions of their availability around the app.
    await supabaseAdmin.from('friend_intents').update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('status', 'open');
    const { data, error } = await supabaseAdmin.from('friend_intents').insert({
      user_id: user.id,
      activity_key: body.activityKey,
      time_window: timeWindow,
      role,
      group_size: groupSize,
      note,
      metro,
      area,
      is_test: isTest,
      expires_at: friendIntentExpiry(timeWindow),
    }).select('id').single();
    if (error || !data) return NextResponse.json({ error: 'Could not post your signal.' }, { status: 500 });
    await recordFriendAction({ userId: user.id, event: 'intent_created', subjectType: 'intent', subjectId: data.id, metadata: { activityKey: body.activityKey, timeWindow } });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (action === 'join_intent') {
    const id = String(body.id || '');
    const { data: intent } = await supabaseAdmin.from('friend_intents').select('*').eq('id', id).maybeSingle();
    if (!intent || intent.status !== 'open' || new Date(intent.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'That signal has closed.' }, { status: 404 });
    }
    if ((intent.is_test === true) !== isTest || (metro && intent.metro !== metro)) {
      return NextResponse.json({ error: 'That signal is not available.' }, { status: 404 });
    }
    if (intent.user_id === user.id) return NextResponse.json({ ok: true, joined: true });
    const { data: existing } = await supabaseAdmin.from('friend_intent_members')
      .select('intent_id').eq('intent_id', id).eq('user_id', user.id).maybeSingle();
    if (!existing) {
      const { error } = await supabaseAdmin.from('friend_intent_members').insert({ intent_id: id, user_id: user.id });
      if (error) return NextResponse.json({ error: 'Could not join that signal.' }, { status: 500 });
    }
    // The first "same here" should not die as a count. Materialize a forming
    // Scene plan and enroll both people, giving them the existing comments
    // thread to choose the exact time/place. A compare-and-set + cleanup keeps
    // concurrent joins from creating duplicate plans.
    let activityId = intent.activity_id as string | null;
    if (!activityId) {
      const definition = friendActivity(intent.activity_key);
      const windowLabel = String(intent.time_window || 'this_week').replaceAll('_', ' ');
      const { data: created } = await supabaseAdmin.from('friend_activities').insert({
        author_id: intent.user_id,
        title: `${definition.label} ${windowLabel} — who’s in?`.slice(0, 140),
        body: intent.note || 'Tap in, then use the comments to pick the exact time and place.',
        category: friendSceneCategory(intent.activity_key),
        kind: 'event',
        area: intent.area,
        metro: intent.metro,
        is_test: intent.is_test,
        expires_at: intent.expires_at,
      }).select('id').single();
      if (created?.id) {
        const { data: claimed } = await supabaseAdmin.from('friend_intents')
          .update({ activity_id: created.id, updated_at: new Date().toISOString() })
          .eq('id', id).is('activity_id', null).select('activity_id').maybeSingle();
        if (claimed?.activity_id) activityId = created.id;
        else {
          await supabaseAdmin.from('friend_activities').delete().eq('id', created.id);
          const { data: winner } = await supabaseAdmin.from('friend_intents').select('activity_id').eq('id', id).maybeSingle();
          activityId = winner?.activity_id || null;
        }
      }
    }
    if (activityId) {
      await supabaseAdmin.from('friend_activity_rsvps').upsert([
        { activity_id: activityId, user_id: intent.user_id, response: 'yes' },
        { activity_id: activityId, user_id: user.id, response: 'yes' },
      ], { onConflict: 'activity_id,user_id' });
    }
    if (!existing) {
      const first = String((user as any).name || 'Someone').split(' ')[0];
      await Promise.allSettled([
        sendPushToUser(intent.user_id, {
          title: `${first} is down too 🤝`,
          body: activityId ? `Your ${friendActivity(intent.activity_key).label} signal is now a forming plan.` : `Someone joined your ${friendActivity(intent.activity_key).label} signal.`,
          url: activityId ? '/friends?view=scene' : '/friends',
          tag: `friend-intent-${id}`,
        }),
        recordFriendAction({ userId: user.id, event: 'intent_joined', subjectType: 'intent', subjectId: id, metadata: { activityKey: intent.activity_key, activityId } }),
      ]);
    }
    const { count } = await supabaseAdmin.from('friend_intent_members').select('user_id', { count: 'exact', head: true }).eq('intent_id', id);
    return NextResponse.json({ ok: true, joined: true, memberCount: 1 + (count || 0), activityId });
  }

  if (action === 'close_intent') {
    const id = String(body.id || '');
    const { data } = await supabaseAdmin.from('friend_intents')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id).eq('status', 'open').select('id').maybeSingle();
    if (!data) return NextResponse.json({ error: 'Signal not found.' }, { status: 404 });
    await recordFriendAction({ userId: user.id, event: 'intent_closed', subjectType: 'intent', subjectId: id });
    return NextResponse.json({ ok: true });
  }

  if (action === 'community_open') {
    const id = String(body.id || '');
    const { data: link } = await supabaseAdmin.from('friend_community_links').select('id, url, metro, is_test, approved')
      .eq('id', id).maybeSingle();
    if (!link || !link.approved || (link.is_test === true) !== isTest || (metro && link.metro !== metro)) {
      return NextResponse.json({ error: 'Community not found.' }, { status: 404 });
    }
    await Promise.all([
      supabaseAdmin.rpc('record_friend_community_open', { p_link_id: id }),
      recordFriendAction({ userId: user.id, event: 'community_opened', subjectType: 'community', subjectId: id }),
    ]);
    return NextResponse.json({ ok: true, url: link.url });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
