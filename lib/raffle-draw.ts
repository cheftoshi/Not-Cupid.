import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleScore, pairSelectionWeight, ageMutual, raffleClosed, raffleEligible, raffleEntriesOpen } from '@/lib/raffle';
import { isGenderMatch } from '@/lib/matching';
import { sendPushToUser } from '@/lib/push';
import { randomInt } from 'crypto';
import {
  buildCoverageFirstShortlist,
  mutualSelectionWeight,
  mutualWinnerSelectionPool,
  selectMutualDinnerPairs,
  type ShortlistDecisionEdge,
} from '@/lib/experiment-shortlist';

const COLS = 'id, name, age, gender, seeking, age_min, age_max, zip, photo_url, archetype, hobbies, music, food, sports, ' +
  'score_honesty, score_emotionality, score_extraversion, score_agreeableness, score_conscientiousness, score_openness, ' +
  'vibes, values_profile, attach_anxiety, attach_avoidance, attach_style, relationship_style, is_test';

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

type DrawResult = {
  ok: true;
  entrants: number;
  drawn: number;
  state: string;
  roundNumber?: number;
  pair?: { a: string; b: string; score: number };
  pairs?: { a: string; b: string; score: number }[];
  shortlist?: { a: string; b: string; score: number }[];
};

type RoundRow = {
  id: string;
  round_number: number;
  response_deadline: string;
  status: string;
  resolution_started_at?: string | null;
  selected_pair_ids?: string[] | null;
};

type PairRow = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  compatibility_score: number;
  a_accepted: boolean | null;
  b_accepted: boolean | null;
  a_favorite: boolean;
  b_favorite: boolean;
  status: string;
  winner_slot: number | null;
};

async function resolveCollectingRound(round: RoundRow, pairs: PairRow[]): Promise<DrawResult | null> {
  const allResponded = pairs.length > 0 && pairs.every((pair) => pair.a_accepted !== null && pair.b_accepted !== null);
  const deadlinePassed = Date.now() >= new Date(round.response_deadline).getTime();
  if (!allResponded && !deadlinePassed) {
    return { ok: true, entrants: new Set(pairs.flatMap((pair) => [pair.user_a_id, pair.user_b_id])).size, drawn: 0, state: 'awaiting-shortlist-response', roundNumber: round.round_number };
  }

  const { data: claimedRound, error: claimError } = await supabaseAdmin.from('dating_experiment_rounds')
    .update({ status: 'resolving', resolution_started_at: new Date().toISOString() })
    .eq('id', round.id)
    .eq('status', 'collecting')
    .select('id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimedRound) {
    return { ok: true, entrants: 0, drawn: 0, state: 'resolving-shortlist', roundNumber: round.round_number };
  }

  const decisionEdges: ShortlistDecisionEdge<string>[] = pairs.map((pair) => ({
    id: pair.id,
    a: pair.user_a_id,
    b: pair.user_b_id,
    score: pair.compatibility_score,
    aAccepted: pair.a_accepted,
    bAccepted: pair.b_accepted,
    aFavorite: pair.a_favorite,
    bFavorite: pair.b_favorite,
  }));
  const mutual = decisionEdges.filter((pair) => pair.aAccepted === true && pair.bAccepted === true);
  const recordedPairIds = round.selected_pair_ids?.length
    ? round.selected_pair_ids
    : pairs
      .filter((pair) => pair.status === 'selected')
      .sort((a, b) => (a.winner_slot ?? 99) - (b.winner_slot ?? 99))
      .map((pair) => pair.id);
  let selected = recordedPairIds
    .map((pairId) => decisionEdges.find((edge) => edge.id === pairId))
    .filter((pair): pair is ShortlistDecisionEdge<string> => pair != null);
  if (recordedPairIds.length && selected.length !== recordedPairIds.length) {
    throw new Error('Recorded Dating Experiment winners do not match the active shortlist.');
  }
  if (!recordedPairIds.length) {
    const randomValues = Array.from(
      { length: RAFFLE.winnerPairCount },
      () => randomInt(0, 1_000_000_000) / 1_000_000_000,
    );
    let randomIndex = 0;
    selected = selectMutualDinnerPairs(
      decisionEdges,
      RAFFLE.winnerPairCount,
      pairSelectionWeight,
      () => randomValues[randomIndex++] ?? randomValues[randomValues.length - 1],
    );
    const firstSelectionPool = mutualWinnerSelectionPool(mutual, RAFFLE.winnerPairCount);
    const totalSelectionWeight = firstSelectionPool.reduce((sum, pair) => sum + mutualSelectionWeight(pair, pairSelectionWeight), 0);
    const { error: auditError } = await supabaseAdmin.from('dating_experiment_rounds').update({
      selection_random_value: randomValues[0],
      selection_random_values: randomValues,
      selection_weight_total: totalSelectionWeight,
      selected_pair_ids: selected.map((pair) => pair.id),
    }).eq('id', round.id).eq('status', 'resolving');
    if (auditError) throw auditError;
  }
  const participantIds = [...new Set(pairs.flatMap((pair) => [pair.user_a_id, pair.user_b_id]))];
  const now = new Date().toISOString();

  if (!selected.length) {
    for (const pair of pairs) {
      const status = pair.a_accepted == null || pair.b_accepted == null ? 'expired' : 'declined';
      const { error: pairStatusError } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
        .update({ status })
        .eq('id', pair.id)
        .eq('status', 'pending');
      if (pairStatusError) throw pairStatusError;
    }
    const { error: roundStatusError } = await supabaseAdmin.from('dating_experiment_rounds').update({
      status: 'no_mutual',
      mutual_pair_count: 0,
      resolved_at: now,
    }).eq('id', round.id).eq('status', 'resolving');
    if (roundStatusError) throw roundStatusError;

    if (participantIds.length) {
      const { data: entries, error: entriesError } = await supabaseAdmin.from('raffle_entries')
        .select('user_id, attempts')
        .eq('event_key', RAFFLE.key)
        .in('user_id', participantIds);
      if (entriesError) throw entriesError;
      for (const entry of entries ?? []) {
        const nextStatus = (entry.attempts ?? 0) < RAFFLE.maxAttempts ? 'entered' : 'passed';
        const { error: entryStatusError } = await supabaseAdmin.from('raffle_entries')
          .update({ status: nextStatus })
          .eq('event_key', RAFFLE.key)
          .eq('user_id', entry.user_id);
        if (entryStatusError) throw entryStatusError;
      }
    }
    return { ok: true, entrants: participantIds.length, drawn: 0, state: 'no-mutual-pair', roundNumber: round.round_number };
  }

  const selectedIndexById = new Map(selected.map((pair, index) => [pair.id, index]));
  for (const pair of pairs) {
    const selectedIndex = selectedIndexById.get(pair.id);
    const status = selectedIndex != null
      ? 'selected'
      : pair.a_accepted === true && pair.b_accepted === true
        ? 'not_selected'
        : pair.a_accepted == null || pair.b_accepted == null
          ? 'expired'
          : 'declined';
    const { error: pairStatusError } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
      .update({ status, winner_slot: selectedIndex != null ? selectedIndex + 1 : null })
      .eq('id', pair.id)
      .eq('status', 'pending');
    if (pairStatusError) throw pairStatusError;
  }

  for (const [index, winner] of selected.entries()) {
    const { error: drawError } = await supabaseAdmin.from('raffle_draws').upsert({
      event_key: RAFFLE.key,
      user_a_id: winner.a,
      user_b_id: winner.b,
      compatibility_score: winner.score,
      a_accepted: true,
      b_accepted: true,
      status: 'both_accepted',
      winner_slot: index + 1,
      restaurant: RAFFLE.restaurant,
      happens_at: RAFFLE.happensAt,
      algorithm_version: RAFFLE.algorithmVersion,
      eligible_pair_count: mutual.length,
      selection_weight: mutualSelectionWeight(winner, pairSelectionWeight),
    }, { onConflict: 'event_key,user_a_id,user_b_id' });
    if (drawError) throw drawError;
  }

  const { error: resolveRoundError } = await supabaseAdmin.from('dating_experiment_rounds').update({
    status: 'resolved',
    mutual_pair_count: mutual.length,
    selected_pair_id: selected[0].id,
    resolved_at: now,
  }).eq('id', round.id).eq('status', 'resolving');
  if (resolveRoundError) throw resolveRoundError;

  const { error: passEntriesError } = await supabaseAdmin.from('raffle_entries')
    .update({ status: 'passed' })
    .eq('event_key', RAFFLE.key)
    .in('status', ['entered', 'picked']);
  if (passEntriesError) throw passEntriesError;
  const { error: pickWinnerError } = await supabaseAdmin.from('raffle_entries')
    .update({ status: 'picked' })
    .eq('event_key', RAFFLE.key)
    .in('user_id', selected.flatMap((pair) => [pair.a, pair.b]));
  if (pickWinnerError) throw pickWinnerError;

  const winnerIds = selected.flatMap((pair) => [pair.a, pair.b]);
  const { data: winnerUsers, error: winnerUsersError } = await supabaseAdmin.from('users')
    .select('id, name')
    .in('id', winnerIds);
  if (winnerUsersError) throw winnerUsersError;
  const nameById = new Map((winnerUsers ?? []).map((user) => [user.id, user.name]));
  const message = {
    title: "It's a date! ✦",
    body: `You chose each other. Open the Dating Experiment for the $${RAFFLE.budget} dinner details.`,
    url: '/dating-experiment',
    tag: `dating-experiment-winner-${round.id}`,
  };
  await Promise.allSettled(winnerIds.map((id) => sendPushToUser(id, message)));
  const selectedSummaries = selected.map((pair) => ({
    a: nameById.get(pair.a) ?? 'Participant A',
    b: nameById.get(pair.b) ?? 'Participant B',
    score: pair.score,
  }));
  return {
    ok: true,
    entrants: participantIds.length,
    drawn: selected.length,
    state: selected.length === 1 ? 'mutual-pair-selected' : 'mutual-pairs-selected',
    roundNumber: round.round_number,
    pair: selectedSummaries[0],
    pairs: selectedSummaries,
  };
}

// Creates a sealed reciprocal shortlist round, or resolves the active round.
// Every participant receives at most the same two-option capacity. Payments and
// subscriptions are never read by this path.
export async function drawRaffle(opts: { force?: boolean } = {}): Promise<DrawResult> {
  const force = opts.force === true;

  const { data: activeRound, error: activeRoundError } = await supabaseAdmin.from('dating_experiment_rounds')
    .select('id, round_number, response_deadline, status, resolution_started_at, selected_pair_ids')
    .eq('event_key', RAFFLE.key)
    .in('status', ['collecting', 'resolving'])
    .maybeSingle();
  if (activeRoundError) throw activeRoundError;
  if (activeRound) {
    if (activeRound.status === 'resolving') {
      const startedAt = activeRound.resolution_started_at ? new Date(activeRound.resolution_started_at).getTime() : 0;
      if (!startedAt || Date.now() - startedAt > 5 * 60_000) {
        const { error: retryError } = await supabaseAdmin.from('dating_experiment_rounds')
          .update({ status: 'collecting', resolution_started_at: null })
          .eq('id', activeRound.id)
          .eq('status', 'resolving');
        if (retryError) throw retryError;
        return { ok: true, entrants: 0, drawn: 0, state: 'resolution-retry-ready', roundNumber: activeRound.round_number };
      }
      return { ok: true, entrants: 0, drawn: 0, state: 'resolving-shortlist', roundNumber: activeRound.round_number };
    }
    const { data: activePairs, error } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
      .select('id, user_a_id, user_b_id, compatibility_score, a_accepted, b_accepted, a_favorite, b_favorite, status, winner_slot')
      .eq('round_id', activeRound.id);
    if (error) throw error;
    return (await resolveCollectingRound(activeRound as RoundRow, (activePairs ?? []) as PairRow[]))!;
  }

  const { data: won, error: wonError } = await supabaseAdmin.from('raffle_draws')
    .select('id, user_a_id, user_b_id, winner_slot')
    .eq('event_key', RAFFLE.key)
    .eq('status', 'both_accepted')
    .order('winner_slot', { ascending: true });
  if (wonError) throw wonError;
  if (won?.length) {
    // Idempotently converge entry bookkeeping if a prior run committed the
    // winner rows immediately before a process interruption.
    const { error: passEntriesError } = await supabaseAdmin.from('raffle_entries')
      .update({ status: 'passed' })
      .eq('event_key', RAFFLE.key)
      .in('status', ['entered', 'picked']);
    if (passEntriesError) throw passEntriesError;
    const winnerIds = won.flatMap((winner) => [winner.user_a_id, winner.user_b_id]);
    const { error: pickWinnerError } = await supabaseAdmin.from('raffle_entries')
      .update({ status: 'picked' })
      .eq('event_key', RAFFLE.key)
      .in('user_id', winnerIds);
    if (pickWinnerError) throw pickWinnerError;
    return { ok: true, entrants: 0, drawn: 0, state: 'winner-locked' };
  }

  // `force` may start an already launch-ready experiment before its normal
  // cap/deadline trigger, but it must never bypass quiet mode or any legal /
  // operational launch gate. Active rounds are still recoverable above.
  if (!raffleEntriesOpen()) return { ok: true, entrants: 0, drawn: 0, state: 'paused' };

  const [{ data: priorRounds }, { count: totalEntries }, { data: entries }] = await Promise.all([
    supabaseAdmin.from('dating_experiment_rounds').select('round_number').eq('event_key', RAFFLE.key).order('round_number', { ascending: false }),
    supabaseAdmin.from('raffle_entries').select('user_id', { count: 'exact', head: true }).eq('event_key', RAFFLE.key).neq('status', 'withdrawn'),
    supabaseAdmin.from('raffle_entries')
      .select('user_id, attempts, questionnaire, terms_version')
      .eq('event_key', RAFFLE.key)
      .eq('status', 'entered'),
  ]);
  const eligibleEntries = (entries ?? []).filter((entry: any) =>
    (entry.attempts ?? 0) < RAFFLE.maxAttempts && entry.terms_version === RAFFLE.termsVersion,
  );
  const eligibleIds = eligibleEntries.map((entry: any) => entry.user_id);
  const canStart = force
    || (raffleEntriesOpen() && raffleClosed())
    || (totalEntries ?? 0) >= RAFFLE.cap
    || (priorRounds?.length ?? 0) > 0;
  if (!canStart) return { ok: true, entrants: eligibleIds.length, drawn: 0, state: 'waiting-for-trigger' };
  if (eligibleIds.length < 2) return { ok: true, entrants: eligibleIds.length, drawn: 0, state: 'not-enough' };

  const [{ data: usersData }, { data: priorWins }, { data: priorPairs }] = await Promise.all([
    supabaseAdmin.from('users').select(COLS).in('id', eligibleIds),
    supabaseAdmin.from('raffle_draws').select('user_a_id, user_b_id').eq('status', 'both_accepted').neq('event_key', RAFFLE.key),
    supabaseAdmin.from('dating_experiment_shortlist_pairs').select('user_a_id, user_b_id').eq('event_key', RAFFLE.key),
  ]);
  const entryByUser = new Map(eligibleEntries.map((entry: any) => [entry.user_id, entry]));
  const wonBefore = new Set<string>();
  (priorWins ?? []).forEach((draw: any) => { wonBefore.add(draw.user_a_id); wonBefore.add(draw.user_b_id); });
  const seenPairs = new Set<string>((priorPairs ?? []).map((pair: any) => pairKey(pair.user_a_id, pair.user_b_id)));
  const pool: any[] = ((usersData as any[]) ?? [])
    .filter((user) => user.is_test !== true && user.photo_url && user.archetype && raffleEligible(user) && !wonBefore.has(user.id))
    .map((user) => ({ ...user, experiment_answers: (entryByUser.get(user.id) as any)?.questionnaire ?? null }));

  const candidates: { a: any; b: any; score: number }[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      if (seenPairs.has(pairKey(a.id, b.id))) continue;
      if (!isGenderMatch(a, b) || !isGenderMatch(b, a) || !ageMutual(a, b)) continue;
      const score = raffleScore(a, b);
      if (score >= RAFFLE.minimumPairScore) candidates.push({ a, b, score });
    }
  }
  const shortlist = buildCoverageFirstShortlist(candidates, RAFFLE.shortlistMaxOptions);
  if (!shortlist.length) return { ok: true, entrants: pool.length, drawn: 0, state: 'no-eligible-pair' };

  const roundNumber = ((priorRounds ?? [])[0]?.round_number ?? 0) + 1;
  const responseDeadline = new Date(Date.now() + RAFFLE.respondHours * 3_600_000).toISOString();
  const { data: round, error: roundError } = await supabaseAdmin.from('dating_experiment_rounds').insert({
    event_key: RAFFLE.key,
    round_number: roundNumber,
    status: 'collecting',
    response_deadline: responseDeadline,
    algorithm_version: RAFFLE.algorithmVersion,
    eligible_user_count: pool.length,
    offered_pair_count: shortlist.length,
  }).select('id').single();
  if (roundError) {
    if (roundError.code === '23505') return { ok: true, entrants: pool.length, drawn: 0, state: 'awaiting-shortlist-response' };
    throw roundError;
  }

  const rows = shortlist.map((edge) => ({
    round_id: round.id,
    event_key: RAFFLE.key,
    user_a_id: edge.a.id,
    user_b_id: edge.b.id,
    compatibility_score: edge.score,
  }));
  const { error: pairError } = await supabaseAdmin.from('dating_experiment_shortlist_pairs').insert(rows);
  if (pairError) {
    await supabaseAdmin.from('dating_experiment_rounds').update({ status: 'cancelled', resolved_at: new Date().toISOString() }).eq('id', round.id);
    throw pairError;
  }

  const participants = [...new Set(shortlist.flatMap((edge) => [edge.a.id, edge.b.id]))];
  for (const id of participants) {
    const currentAttempts = (entryByUser.get(id) as any)?.attempts ?? 0;
    const { error: entryPickError } = await supabaseAdmin.from('raffle_entries')
      .update({ attempts: currentAttempts + 1, status: 'picked' })
      .eq('event_key', RAFFLE.key)
      .eq('user_id', id)
      .eq('status', 'entered');
    if (entryPickError) throw entryPickError;
  }
  const optionCount = new Map<string, number>();
  shortlist.forEach((edge) => {
    optionCount.set(edge.a.id, (optionCount.get(edge.a.id) ?? 0) + 1);
    optionCount.set(edge.b.id, (optionCount.get(edge.b.id) ?? 0) + 1);
  });
  await Promise.allSettled(participants.map((id) => {
    const count = optionCount.get(id) ?? 1;
    return sendPushToUser(id, {
      title: `Your private shortlist is ready ✦`,
      body: `Meet ${count === 1 ? 'your strongest option' : 'your two strongest options'} and privately say yes or pass within ${RAFFLE.respondHours} hours.`,
      url: '/dating-experiment',
      tag: `dating-experiment-shortlist-${round.id}`,
    });
  }));

  return {
    ok: true,
    entrants: pool.length,
    drawn: shortlist.length,
    state: 'shortlist-created',
    roundNumber,
    shortlist: shortlist.map((edge) => ({ a: edge.a.name, b: edge.b.name, score: edge.score })),
  };
}
