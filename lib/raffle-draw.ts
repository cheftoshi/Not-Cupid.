import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleScore, pairSelectionWeight, ageMutual, raffleClosed, raffleEligible } from '@/lib/raffle';
import { isGenderMatch } from '@/lib/matching';
import { sendPushToUser } from '@/lib/push';
import { randomInt } from 'crypto';
import {
  buildCoverageFirstShortlist,
  mutualSelectionWeight,
  selectMutualDinnerPair,
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
  shortlist?: { a: string; b: string; score: number }[];
};

type RoundRow = {
  id: string;
  round_number: number;
  response_deadline: string;
  status: string;
  resolution_started_at?: string | null;
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
  const previouslySelected = pairs.find((pair) => pair.status === 'selected');
  let selected = previouslySelected
    ? decisionEdges.find((pair) => pair.id === previouslySelected.id) ?? null
    : null;
  if (!previouslySelected) {
    const randomValue = randomInt(0, 1_000_000_000) / 1_000_000_000;
    const totalSelectionWeight = mutual.reduce((sum, pair) => sum + mutualSelectionWeight(pair, pairSelectionWeight), 0);
    const { error: auditError } = await supabaseAdmin.from('dating_experiment_rounds').update({
      selection_random_value: randomValue,
      selection_weight_total: totalSelectionWeight,
    }).eq('id', round.id).eq('status', 'resolving');
    if (auditError) throw auditError;
    selected = selectMutualDinnerPair(decisionEdges, pairSelectionWeight, () => randomValue);
  }
  const participantIds = [...new Set(pairs.flatMap((pair) => [pair.user_a_id, pair.user_b_id]))];
  const now = new Date().toISOString();

  if (!selected) {
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

  for (const pair of pairs) {
    const status = pair.id === selected.id
      ? 'selected'
      : pair.a_accepted === true && pair.b_accepted === true
        ? 'not_selected'
        : pair.a_accepted == null || pair.b_accepted == null
          ? 'expired'
          : 'declined';
    const { error: pairStatusError } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
      .update({ status })
      .eq('id', pair.id)
      .eq('status', 'pending');
    if (pairStatusError) throw pairStatusError;
  }

  const { error: drawError } = await supabaseAdmin.from('raffle_draws').upsert({
    event_key: RAFFLE.key,
    user_a_id: selected.a,
    user_b_id: selected.b,
    compatibility_score: selected.score,
    a_accepted: true,
    b_accepted: true,
    status: 'both_accepted',
    restaurant: RAFFLE.restaurant,
    happens_at: RAFFLE.happensAt,
    algorithm_version: RAFFLE.algorithmVersion,
    eligible_pair_count: mutual.length,
    selection_weight: mutualSelectionWeight(selected, pairSelectionWeight),
  }, { onConflict: 'event_key,user_a_id,user_b_id' });
  if (drawError) throw drawError;

  const { error: resolveRoundError } = await supabaseAdmin.from('dating_experiment_rounds').update({
    status: 'resolved',
    mutual_pair_count: mutual.length,
    selected_pair_id: selected.id,
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
    .in('user_id', [selected.a, selected.b]);
  if (pickWinnerError) throw pickWinnerError;

  const [{ data: a }, { data: b }] = await Promise.all([
    supabaseAdmin.from('users').select('name').eq('id', selected.a).single(),
    supabaseAdmin.from('users').select('name').eq('id', selected.b).single(),
  ]);
  const message = {
    title: "It's a date! ✦",
    body: `You chose each other. Open the Dating Experiment for the $${RAFFLE.budget} dinner details.`,
    url: '/dating-experiment',
    tag: `dating-experiment-winner-${round.id}`,
  };
  await Promise.allSettled([sendPushToUser(selected.a, message), sendPushToUser(selected.b, message)]);
  return {
    ok: true,
    entrants: participantIds.length,
    drawn: 1,
    state: 'mutual-pair-selected',
    roundNumber: round.round_number,
    pair: { a: a?.name ?? 'Participant A', b: b?.name ?? 'Participant B', score: selected.score },
  };
}

// Creates a sealed reciprocal shortlist round, or resolves the active round.
// Every participant receives at most the same two-option capacity. Payments and
// subscriptions are never read by this path.
export async function drawRaffle(opts: { force?: boolean } = {}): Promise<DrawResult> {
  const force = opts.force === true;

  const { data: won, error: wonError } = await supabaseAdmin.from('raffle_draws')
    .select('id, user_a_id, user_b_id')
    .eq('event_key', RAFFLE.key)
    .eq('status', 'both_accepted')
    .limit(1);
  if (wonError) throw wonError;
  if (won?.length) {
    // If a retry happens after the winner row commits but before the round and
    // entry bookkeeping does, converge that state instead of leaving a round
    // permanently stuck in `resolving`.
    const winner = won[0];
    const { data: unfinishedRound, error: unfinishedError } = await supabaseAdmin.from('dating_experiment_rounds')
      .select('id')
      .eq('event_key', RAFFLE.key)
      .in('status', ['collecting', 'resolving'])
      .maybeSingle();
    if (unfinishedError) throw unfinishedError;
    if (unfinishedRound) {
      const { data: selectedPair, error: selectedPairError } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
        .select('id')
        .eq('round_id', unfinishedRound.id)
        .eq('status', 'selected')
        .maybeSingle();
      if (selectedPairError) throw selectedPairError;
      const { error: finishRoundError } = await supabaseAdmin.from('dating_experiment_rounds').update({
        status: 'resolved',
        selected_pair_id: selectedPair?.id ?? null,
        resolved_at: new Date().toISOString(),
      }).eq('id', unfinishedRound.id).in('status', ['collecting', 'resolving']);
      if (finishRoundError) throw finishRoundError;
      const { error: passEntriesError } = await supabaseAdmin.from('raffle_entries')
        .update({ status: 'passed' })
        .eq('event_key', RAFFLE.key)
        .in('status', ['entered', 'picked']);
      if (passEntriesError) throw passEntriesError;
      const { error: pickWinnerError } = await supabaseAdmin.from('raffle_entries')
        .update({ status: 'picked' })
        .eq('event_key', RAFFLE.key)
        .in('user_id', [winner.user_a_id, winner.user_b_id]);
      if (pickWinnerError) throw pickWinnerError;
    }
    return { ok: true, entrants: 0, drawn: 0, state: 'winner-locked' };
  }

  const { data: activeRound, error: activeRoundError } = await supabaseAdmin.from('dating_experiment_rounds')
    .select('id, round_number, response_deadline, status, resolution_started_at')
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
      .select('id, user_a_id, user_b_id, compatibility_score, a_accepted, b_accepted, a_favorite, b_favorite, status')
      .eq('round_id', activeRound.id);
    if (error) throw error;
    return (await resolveCollectingRound(activeRound as RoundRow, (activePairs ?? []) as PairRow[]))!;
  }

  if (!RAFFLE.entriesOpen && !force) return { ok: true, entrants: 0, drawn: 0, state: 'paused' };

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
    || (RAFFLE.entriesOpen && raffleClosed())
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
