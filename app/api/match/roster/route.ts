// GET /api/match/roster
//
// The curated roster: the caller's top compatible candidates to CHOOSE from
// (vs. the algo assigning one). Computed live with the same scoring as the
// auto-matcher, so it always agrees on eligibility. Returns only safe public
// fields. The profile preview intentionally includes the candidate's own bio,
// prompts, and interests; private deep-quiz fields and extra photos stay out.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { MATCHING_ALGORITHM_VERSION, compatibilityBreakdown, rankCandidates } from '@/lib/matching';
import { reciprocalMomentumAdjustment, type ReciprocalOutcomeStats } from '@/lib/reciprocity';
import { releaseTimedOutMatches, liveMatchesFor, isMatchLive, MAX_CONNECTIONS, MAX_IGNORED_PICKS } from '@/lib/match-actions';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { isHardLocked } from '@/lib/ghost';
import {
  LOVE_ROSTER_OPTIONS,
  LOVE_INCLUDED_PICKS,
  LOVE_MAX_PENDING_INCOMING,
  ROSTER_RETURN_ROTATION_HOURS,
  addedRosterCandidateIds,
  activeUserCutoffIso,
  matchingActivitySegment,
  orderForRosterRotation,
  rosterExposureCutoffIso,
} from '@/lib/matching-policy';
import { normalizeProfilePrompts } from '@/lib/profile-prompts';
import { lovePickAccessFor } from '@/lib/love-pick-access';

// ZIP → human metro label (e.g. "Boston, MA"), or "Boston area" fallback.
// Never returns the raw ZIP — that's a location-privacy leak.
function metroLabel(zip: string | null | undefined): string {
  const m = metroOf(zip);
  if (m && METRO_CENTERS[m]) return `${METRO_CENTERS[m].city}, ${METRO_CENTERS[m].state}`;
  return 'Boston area';
}

export const dynamic = 'force-dynamic';

// Roster snapshot rotates at most once per return day. Within that window the same
// people show (minus any who got taken, with fresh backfill), so the roster
// feels stable instead of reshuffling on every reload. The API returns the next
// rotation time so the dashboard can make the daily return loop visible.
const ROSTER_TTL_MS = ROSTER_RETURN_ROTATION_HOURS * 60 * 60 * 1000;

export async function composeLoveRosterForUser(
  user: any,
  options: { recordNotificationChange?: boolean; interactive?: boolean } = {},
) {
  // Free any of the caller's timed-out matches first, so a just-expired match
  // doesn't block their roster (and so they show as 'waiting' for picking).
  await releaseTimedOutMatches(user.id);

  // Capacity model: you can run up to MAX_CONNECTIONS live conversations. The
  // roster keeps showing until you're maxed out (it no longer disappears the
  // moment you have one match). We also exclude anyone you're already talking to.
  const now = Date.now();
  const myLive = await liveMatchesFor(user.id);
  // A scheduled verification can refresh roster membership, but it must not
  // start a person's 24-hour included-pick clock before they actually return.
  const pickAccess = options.interactive === false ? null : await lovePickAccessFor(user);
  const livePartnerIds = new Set<string>(
    myLive.map((m: any) => (m.user_1_id === user.id ? m.user_2_id : m.user_1_id))
  );
  // At capacity, the roster is still BROWSABLE — the user just can't open a new
  // chat without closing one first (the client gates picking on `atCapacity`).
  const atCapacity = myLive.length >= MAX_CONNECTIONS;
  if (user.pool_active === false) return { roster: [], paused: true, rosterChanged: false };

  // Ghosted/paused users are locked out of matching on BOTH lines. They can
  // self-reactivate (free, non-destructive) unless they're past the hard cap,
  // in which case only an admin can restore them.
  const cooldownActive = user.matching_cooldown_until && new Date(user.matching_cooldown_until).getTime() > now;
  if (user.matching_disabled_at || cooldownActive) {
    return { roster: [], ghosted: true, hardLocked: isHardLocked(user.ghost_strikes), rosterChanged: false };
  }

  // Fully free (no live matches) but status got stuck → normalize to 'waiting'
  // so back-compat consumers (pools/legacy) read them correctly.
  if (myLive.length === 0 && user.status !== 'waiting') {
    await supabaseAdmin.from('users').update({ status: 'waiting' }).eq('id', user.id);
  }

  // Candidate pool. We no longer filter by status='waiting' (that was the
  // single-match lock) — instead we surface anyone with spare capacity and
  // filter out those at the cap below.
  // Select ONLY what ranking + the free roster preview need — `select('*')`
  // would haul private/account fields and scale badly with user count.
  const POOL_COLS =
    'id, name, age, gender, seeking, age_min, age_max, zip, photo_url, intro_video_url, archetype, occupation, ' +
    'bio, prompts, relationship_style, love_availability, vibes, values_profile, attach_anxiety, attach_avoidance, attach_style, music, food, hobbies, sports, ' +
    'score_honesty, score_emotionality, score_extraversion, score_agreeableness, ' +
    'score_conscientiousness, score_openness, last_matched_at, ignored_picks, is_test';
  const nowIso = new Date().toISOString();
  // Responsiveness gate: bench chronic no-shows (ignored_picks > MAX_IGNORED_PICKS)
  // so the pool stops surfacing people who never accept. `applyIgnored` is dropped
  // on the pre-migration fallback below if the column doesn't exist yet.
  const buildPool = (applyIgnored: boolean) => {
    let q = supabaseAdmin
      .from('users')
      .select(POOL_COLS)
      .eq('pool_active', true)
      .eq('is_blocked', false)
      .neq('id', user.id)
      .is('matching_disabled_at', null)
      .is('deleted_at', null)
      .or(`matching_cooldown_until.is.null,matching_cooldown_until.lt.${nowIso}`);
    // Realm segregation: test ↔ test, real ↔ real only.
    q = (user as any).is_test === true ? q.eq('is_test', true) : q.not('is_test', 'is', true);
    if (applyIgnored) q = q.lte('ignored_picks', MAX_IGNORED_PICKS);
    return q;
  };
  let { data: pool, error: poolErr } = await buildPool(true);
  if (poolErr) {
    // ignored_picks not migrated yet (or other error) → retry without that filter.
    ({ data: pool } = await buildPool(false));
  }

  pool = pool ?? [];

  // Wait-time decay input (same derivation as /api/match).
  const { data: lastEnded } = await supabaseAdmin
    .from('matches')
    .select('ended_at')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const waitStartMs = lastEnded?.ended_at ? new Date(lastEnded.ended_at).getTime() : new Date(user.created_at).getTime();
  const waitDays = Math.max(0, (Date.now() - waitStartMs) / 86_400_000);

  // Exclude anyone this user has already matched with before (no repeats) AND
  // anyone they're currently in a live conversation with.
  const { data: history } = await supabaseAdmin
    .from('match_history')
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
  const seen = new Set<string>(livePartnerIds);
  for (const h of history ?? []) {
    seen.add(h.user_a_id === user.id ? h.user_b_id : h.user_a_id);
  }
  let freshPool = pool.filter((p: any) => !seen.has(p.id));

  // Fetch operational ranking inputs together. These used to run in three
  // sequential waves (live capacity, sessions/exposures, reciprocity), which
  // made roster latency grow with database round trips even though the inputs
  // are independent.
  const liveCount = new Map<string, number>();
  const pendingIncoming = new Map<string, number>();
  const activityByCandidateId = new Map<string, ReturnType<typeof matchingActivitySegment>>();
  const recentlyShownIds = new Set<string>();
  const outcomeByCandidateId = new Map<string, ReciprocalOutcomeStats>();
  if (freshPool.length > 0) {
    const poolIds = freshPool.map((p: any) => p.id);
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const [
      { data: m1 },
      { data: m2 },
      { data: activeSessions },
      { data: recentExposures, error: exposureErr },
      { data: outcomeRows, error: outcomeErr },
    ] = await Promise.all([
      supabaseAdmin.from('matches')
        .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, expires_at, status, ended_at')
        .in('user_1_id', poolIds).is('ended_at', null).neq('status', 'expired'),
      supabaseAdmin.from('matches')
        .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, expires_at, status, ended_at')
        .in('user_2_id', poolIds).is('ended_at', null).neq('status', 'expired'),
      supabaseAdmin
        .from('sessions')
        .select('user_id, last_used_at')
        .in('user_id', poolIds)
        .gte('last_used_at', activeUserCutoffIso())
        .limit(5000),
      supabaseAdmin
        .from('roster_exposures')
        .select('candidate_id')
        .eq('user_id', user.id)
        .gte('shown_at', rosterExposureCutoffIso()),
      supabaseAdmin.rpc('candidate_reciprocity_stats', {
        p_candidate_ids: poolIds,
        p_since: since,
      }),
    ]);
    const byId = new Map<string, any>();
    for (const m of [...(m1 ?? []), ...(m2 ?? [])]) byId.set(m.id, m);
    const poolSet = new Set(poolIds);
    for (const m of byId.values()) {
      if (!isMatchLive(m)) continue;
      for (const uid of [m.user_1_id, m.user_2_id]) {
        if (poolSet.has(uid)) liveCount.set(uid, (liveCount.get(uid) || 0) + 1);
      }
      if (m.status === 'pending') {
        if (poolSet.has(m.user_1_id) && !m.user_1_accepted && m.user_2_accepted) {
          pendingIncoming.set(m.user_1_id, (pendingIncoming.get(m.user_1_id) || 0) + 1);
        }
        if (poolSet.has(m.user_2_id) && !m.user_2_accepted && m.user_1_accepted) {
          pendingIncoming.set(m.user_2_id, (pendingIncoming.get(m.user_2_id) || 0) + 1);
        }
      }
    }
    freshPool = freshPool.filter((p: any) =>
      (liveCount.get(p.id) || 0) < MAX_CONNECTIONS &&
      (pendingIncoming.get(p.id) || 0) < LOVE_MAX_PENDING_INCOMING
    );
    const latestSessionByUser = new Map<string, string>();
    for (const session of activeSessions ?? []) {
      const previous = latestSessionByUser.get(session.user_id);
      if (!previous || session.last_used_at > previous) latestSessionByUser.set(session.user_id, session.last_used_at);
    }
    for (const [candidateId, lastUsedAt] of latestSessionByUser) {
      activityByCandidateId.set(candidateId, matchingActivitySegment(lastUsedAt));
    }
    // Graceful until the migration is applied: exposure history is an
    // optimization, never a reason for the roster endpoint to fail.
    if (!exposureErr) {
      for (const exposure of recentExposures ?? []) recentlyShownIds.add(exposure.candidate_id);
    }
    if (!outcomeErr) {
      for (const row of outcomeRows ?? []) {
        outcomeByCandidateId.set(row.candidate_id, {
          invitations: Number(row.invitations ?? 0),
          acceptedInvitations: Number(row.accepted_invitations ?? 0),
          mutualMatches: Number(row.mutual_matches ?? 0),
          repliedMatches: Number(row.replied_matches ?? 0),
        });
      }
    }
  }

  // Matching V3.1 adjustment: compatibility still leads, while spare capacity,
  // richer mutual signal confidence, and reciprocal momentum break near-ties.
  const candidateAdjustments = new Map<string, number>();
  const breakdownByCandidateId = new Map<string, ReturnType<typeof compatibilityBreakdown>>();
  const reciprocalByCandidateId = new Map<string, number>();
  for (const p of freshPool as any[]) {
    const ignored = Math.max(0, p.ignored_picks ?? 0);
    const live = liveCount.get(p.id) || 0;
    const incoming = pendingIncoming.get(p.id) || 0;
    const neverMatched = !p.last_matched_at;
    const breakdown = compatibilityBreakdown(user, p);
    const reciprocal = reciprocalMomentumAdjustment(outcomeByCandidateId.get(p.id) ?? {
      invitations: 0, acceptedInvitations: 0, mutualMatches: 0, repliedMatches: 0,
    });
    breakdownByCandidateId.set(p.id, breakdown);
    reciprocalByCandidateId.set(p.id, reciprocal);
    const confidenceBonus = Math.max(0, (breakdown.confidence - 0.45) * 2.5);
    // Near-equal candidates with more room to
    // respond should surface first. This reduces invitation deadlocks without
    // hiding someone merely because they already have one or two chats.
    const openCapacityBonus = Math.max(0, LOVE_INCLUDED_PICKS - live - 1) * 2;
    const adj =
      (neverMatched ? 2 : 0) +
      openCapacityBonus -
      ignored * 3 -
      incoming * 3 +
      confidenceBonus +
      reciprocal;
    if (adj) candidateAdjustments.set(p.id, adj);
  }

  const { ranked } = rankCandidates(user, freshPool, { waitDays, candidateAdjustments });
  const rotationRanked = orderForRosterRotation(ranked, activityByCandidateId, recentlyShownIds);
  // Three included picks plus seven browseable alternatives keeps choice useful
  // without turning Love Line into an endless feed.
  const size = LOVE_ROSTER_OPTIONS;

  // Map of currently-eligible candidates by id (for snapshot validation +
  // hydration). Anyone in the prior snapshot who's since been taken / matched /
  // dropped out simply won't be in here and gets filtered out.
  const eligibleById = new Map(ranked.map((c) => [c.user.id, c]));

  // Decide the ordered list of candidate ids for this roster.
  const snapshot: string[] = Array.isArray(user.roster_snapshot) ? user.roster_snapshot : [];
  const refreshedAt = user.roster_refreshed_at ? new Date(user.roster_refreshed_at).getTime() : 0;
  const snapshotFresh = refreshedAt > 0 && Date.now() - refreshedAt < ROSTER_TTL_MS;

  let orderedIds: string[];
  let persist = false;

  if (snapshotFresh) {
    // Keep the snapshot's still-eligible members in their original order, then
    // backfill from the live ranking to keep the roster full when people drop.
    const kept = snapshot.filter((id) => eligibleById.has(id));
    const keptSet = new Set(kept);
    const backfill = rotationRanked.map((c) => c.user.id).filter((id) => !keptSet.has(id));
    orderedIds = [...kept, ...backfill].slice(0, size);
    // Only re-persist if the membership actually changed (backfill kicked in).
    if (kept.length < Math.min(snapshot.length, size)) persist = true;
  } else {
    // Stale or no snapshot → recompute fresh and persist with a new timestamp.
    orderedIds = rotationRanked.slice(0, size).map((c) => c.user.id);
    persist = true;
  }

  const roster = orderedIds
    .map((id) => eligibleById.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({
      id: c.user.id,
      name: c.user.name,
      age: c.user.age,
      photo_url: c.user.photo_url,
      hasIntroVideo: !!c.user.intro_video_url,
      archetype: c.user.archetype,
      occupation: c.user.occupation || null,
      bio: typeof c.user.bio === 'string' ? c.user.bio.trim().slice(0, 500) || null : null,
      prompts: normalizeProfilePrompts(c.user.prompts).slice(0, 3),
      interests: Array.from(new Set([
        ...(Array.isArray(c.user.music) ? c.user.music : []),
        ...(Array.isArray(c.user.food) ? c.user.food : []),
        ...(Array.isArray(c.user.hobbies) ? c.user.hobbies : []),
        ...(Array.isArray(c.user.sports) ? c.user.sports : []),
      ].map((item) => String(item).trim()).filter(Boolean))).slice(0, 8),
      // Privacy: never expose the exact ZIP. Show the metro label only.
      metro: metroLabel(c.user.zip),
      relationship_style: c.user.relationship_style,
      loveAvailability: c.user.love_availability === 'actively_looking' ? 'actively_looking' : 'open_to_meeting',
      activityLabel: activityByCandidateId.get(c.user.id) === 'recent'
        ? 'active recently'
        : activityByCandidateId.get(c.user.id) === 'active'
          ? 'active lately'
          : null,
      score: c.score,
      why: breakdownByCandidateId.get(c.user.id)?.reasons[0] ?? 'there is enough overlap here to be curious',
      reasonCodes: breakdownByCandidateId.get(c.user.id)?.reasonCodes ?? [],
      scoreConfidence: breakdownByCandidateId.get(c.user.id)?.confidence ?? 0,
      algorithmVersion: MATCHING_ALGORITHM_VERSION,
    }));

  const priorIds = snapshot.slice(0, size);
  const currentIds = roster.map((candidate) => candidate.id);
  // "Changed" means at least one genuinely new person entered a previously
  // composed roster. Reordering the same people, first-time composition, or a
  // roster shrinking to empty never earns a rotation notification.
  const addedCandidateIds = addedRosterCandidateIds(priorIds, currentIds);
  const rosterChanged = priorIds.length > 0 && addedCandidateIds.length > 0;

  if (persist) {
    // Fresh recompute resets the 24-hour clock; a backfill-only change keeps the
    // existing clock so the rotation cadence stays honest.
    const updates: Record<string, any> = { roster_snapshot: roster.map((r) => r.id) };
    if (!snapshotFresh) updates.roster_refreshed_at = new Date().toISOString();
    if (!snapshotFresh && rosterChanged && options.recordNotificationChange) {
      updates.roster_changed_at = new Date().toISOString();
    }
    await supabaseAdmin.from('users').update(updates).eq('id', user.id);

    // Record only rosters that were actually composed/persisted. Upsert keeps
    // one latest exposure per pair, which is all the seven-day cooldown needs.
    if (roster.length > 0) {
      const shownAt = new Date().toISOString();
      await supabaseAdmin
        .from('roster_exposures')
        .upsert(
          roster.map((candidate, position) => ({
            user_id: user.id,
            candidate_id: candidate.id,
            shown_at: shownAt,
            position: position + 1,
            score: candidate.score,
            algorithm_version: MATCHING_ALGORITHM_VERSION,
            reason_codes: candidate.reasonCodes,
            reciprocal_adjustment: reciprocalByCandidateId.get(candidate.id) ?? 0,
          })),
          { onConflict: 'user_id,candidate_id' },
        )
        .then(undefined, () => {});
    }
  }

  const rotationStart = snapshotFresh ? refreshedAt : Date.now();
  let connectionCredits = pickAccess?.credits ?? [];
  if (connectionCredits.length > 0) {
    const rosterIds = new Set(roster.map((candidate) => candidate.id));
    const orphaned = connectionCredits.filter((credit) => credit.intendedCandidateId && !rosterIds.has(credit.intendedCandidateId));
    if (orphaned.length > 0) {
      await supabaseAdmin.from('love_connection_unlocks').update({
        status: 'credit',
        intended_candidate_id: null,
      }).in('id', orphaned.map((credit) => credit.id)).eq('user_id', user.id).in('status', ['purchased', 'credit']);
      const orphanedIds = new Set(orphaned.map((credit) => credit.id));
      connectionCredits = connectionCredits.map((credit) => orphanedIds.has(credit.id)
        ? { ...credit, intendedCandidateId: null }
        : credit);
    }
  }

  return {
    roster,
    atCapacity,
    includedPicksRemaining: pickAccess?.includedRemaining ?? LOVE_INCLUDED_PICKS,
    includedPicksUsed: pickAccess?.includedUsed ?? 0,
    hasConnectionCredit: connectionCredits.length > 0,
    connectionCreditCount: connectionCredits.length,
    connectionCreditCandidateIds: connectionCredits.flatMap((credit) => credit.intendedCandidateId ? [credit.intendedCandidateId] : []),
    flexibleConnectionCreditCount: connectionCredits.filter((credit) => credit.intendedCandidateId === null).length,
    hasFlexibleConnectionCredit: connectionCredits.some((credit) => credit.intendedCandidateId === null),
    pro: pickAccess?.pro ?? false,
    maxConnections: MAX_CONNECTIONS,
    rosterChanged: !snapshotFresh && rosterChanged,
    addedCandidateCount: !snapshotFresh ? addedCandidateIds.length : 0,
    nextRotationAt: new Date(rotationStart + ROSTER_TTL_MS).toISOString(),
    rotationHours: ROSTER_RETURN_ROTATION_HOURS,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // If a background verification already produced a fresh roster, opening it
  // is the notification: mark that pending change seen so cron cannot email a
  // user about profiles they have already viewed.
  const changedAt = user.roster_changed_at ? new Date(user.roster_changed_at).getTime() : 0;
  const notifiedAt = user.roster_change_notified_at ? new Date(user.roster_change_notified_at).getTime() : 0;
  if (changedAt > notifiedAt) {
    await supabaseAdmin
      .from('users')
      .update({ roster_change_notified_at: user.roster_changed_at })
      .eq('id', user.id);
  }

  return NextResponse.json(await composeLoveRosterForUser(user));
}
