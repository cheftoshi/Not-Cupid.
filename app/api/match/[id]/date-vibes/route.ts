// /api/match/[id]/date-vibes
//
// GET — return the full state of the date-vibes session for the
//       current user on this match: their saved interests, partner's
//       saved interests (so we can hint at overlap), the filtered deck
//       of activities they HAVEN'T swiped on yet, and the list of
//       mutual-yes matches so far.
//
// PUT — save the current user's interest selections for this match.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  CURATED_ACTIVITIES,
  filterDeck,
  INTEREST_OPTIONS,
  type Activity,
  type Interest,
} from '@/lib/activities';
import { fetchAllLiveActivities } from '@/lib/live-events';
import { metroOf } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

const VALID_INTERESTS = new Set<string>(INTEREST_OPTIONS.map((o) => o.value));

type LoadResult =
  | { ok: false; error: NextResponse }
  | { ok: true; match: any; partnerId: string };

async function loadMatchOrError(matchId: string, userId: string): Promise<LoadResult> {
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, status, created_at')
    .eq('id', matchId)
    .single();
  if (!match) return { ok: false, error: NextResponse.json({ error: 'Match not found' }, { status: 404 }) };
  if (match.user_1_id !== userId && match.user_2_id !== userId) {
    return { ok: false, error: NextResponse.json({ error: 'Not your match' }, { status: 403 }) };
  }
  if (!match.user_1_accepted || !match.user_2_accepted) {
    return { ok: false, error: NextResponse.json({ error: 'Date vibes unlock once both accept' }, { status: 400 }) };
  }
  return {
    ok: true,
    match,
    partnerId: match.user_1_id === userId ? match.user_2_id : match.user_1_id,
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const loaded = await loadMatchOrError(params.id, user.id);
  if (!loaded.ok) return loaded.error;
  const { partnerId } = loaded;

  // Pull both users' saved interests (one query covers both rows).
  const { data: vibes } = await supabaseAdmin
    .from('match_date_vibes')
    .select('user_id, interests')
    .eq('match_id', params.id)
    .in('user_id', [user.id, partnerId]);

  const myRow = (vibes ?? []).find((v: any) => v.user_id === user.id);
  const partnerRow = (vibes ?? []).find((v: any) => v.user_id === partnerId);
  const myInterests: Interest[] = (myRow?.interests ?? []) as Interest[];
  const partnerInterests: Interest[] = (partnerRow?.interests ?? []) as Interest[];

  // Pull this user's swipes — for filtering the deck and counting.
  const { data: swipes } = await supabaseAdmin
    .from('activity_swipes')
    .select('activity_id, decision, user_id')
    .eq('match_id', params.id);

  const mySwipedIds = new Set((swipes ?? []).filter((s: any) => s.user_id === user.id).map((s: any) => s.activity_id));

  // Compute mutual-yes matches (both users said yes on same activity_id).
  const yesByActivity = new Map<string, Set<string>>();
  for (const s of swipes ?? []) {
    if (s.decision !== 'yes') continue;
    if (!yesByActivity.has(s.activity_id)) yesByActivity.set(s.activity_id, new Set());
    yesByActivity.get(s.activity_id)!.add(s.user_id);
  }
  const mutualIds = new Set<string>();
  for (const [aid, users] of yesByActivity) {
    if (users.has(user.id) && users.has(partnerId)) mutualIds.add(aid);
  }

  // Live events from all enabled external sources (Ticketmaster + Yelp +
  // Boston Calendar). Each source no-ops gracefully if its API key isn't
  // set. The aggregator also filters out admin-blacklisted items.
  // Location-aware: pull events for the couple's metro (read off the
  // current user's zip — both sides are in the same 25mi cluster, so same
  // metro). Falls back to Boston if the zip isn't mapped.
  const metro = metroOf(user.zip) ?? 'boston';
  let live: Activity[] = [];
  try {
    live = await fetchAllLiveActivities(metro);
  } catch (e) {
    console.warn('date-vibes: live fetch failed', e);
  }

  const fullPool: Activity[] = [...CURATED_ACTIVITIES, ...live];

  // Date tier escalates on three signals:
  //   • action: +1 per logged date — pressing "we went on a date" moves the
  //     deck to the next round (date_feedback is one row per user per match)
  //   • intent: +1 per activity they've BOTH said yes to (a planned date)
  //   • time: +1 per week the match has been alive
  // A fresh match opens on tier 1 (light/public) and climbs toward the
  // intimate "date 3" options as they go on dates, agree on things, and age.
  const { count: datesLogged } = await supabaseAdmin
    .from('date_feedback')
    .select('match_id', { count: 'exact', head: true })
    .eq('match_id', params.id);
  const matchAgeDays = loaded.match.created_at
    ? (Date.now() - new Date(loaded.match.created_at).getTime()) / 86_400_000
    : 0;
  const dateNumber = Math.min(3, 1 + (datesLogged ?? 0) + mutualIds.size + Math.floor(matchAgeDays / 7)) as 1 | 2 | 3;

  // Filter by tier (date progression) + interest overlap, then drop swiped.
  const filtered = filterDeck(fullPool, myInterests, partnerInterests, dateNumber);
  const deck = filtered.filter((a) => !mySwipedIds.has(a.id));

  // Mutual matches — hydrate full Activity objects.
  const byId = new Map(fullPool.map((a) => [a.id, a]));
  const mutualMatches = Array.from(mutualIds)
    .map((id) => byId.get(id))
    .filter((a): a is Activity => !!a);

  return NextResponse.json({
    myInterests,
    partnerInterests,
    deck,
    mutualMatches,
    dateNumber,
    counts: {
      deck: deck.length,
      mutual: mutualMatches.length,
      partnerHasPicked: partnerInterests.length > 0,
      iPicked: myInterests.length > 0,
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const loaded = await loadMatchOrError(params.id, user.id);
  if (!loaded.ok) return loaded.error;

  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body?.interests) ? body.interests : [];
  const cleaned: string[] = Array.from(new Set(
    raw.filter((v: any) => typeof v === 'string' && VALID_INTERESTS.has(v))
  ));
  if (cleaned.length > 8) {
    return NextResponse.json({ error: 'Pick at most 8 interests' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('match_date_vibes')
    .upsert(
      {
        match_id: params.id,
        user_id: user.id,
        interests: cleaned,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'match_id,user_id' }
    );

  if (error) {
    console.error('date-vibes PUT error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, interests: cleaned });
}
