import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleScore, pairSelectionWeight, raffleEligible } from '@/lib/raffle';
import { sendPushToUser } from '@/lib/push';
import {
  sendDatingExperimentShortlistEmails,
  sendDatingExperimentWinnerEmails,
} from '@/lib/dating-experiment-email';
import { randomInt } from 'crypto';
import {
  datingExperimentCanShortlist,
  getDatingExperimentEvent,
  type DatingExperimentEvent,
} from '@/lib/dating-experiment-event';
import {
  reciprocalExperimentAgeMatch,
  reciprocalExperimentGenderMatch,
  resolveExperimentPreferences,
} from '@/lib/experiment-preferences';
import {
  buildCoverageFirstShortlist,
  assignDinnerSlots,
  mutualSelectionWeight,
  mutualWinnerSelectionPool,
  selectMutualDinnerPairsForSlots,
  type SlotAwareDecisionEdge,
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

type WinnerRow = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  winner_slot: number | null;
  restaurant: string | null;
  happens_at: string | null;
};

const HOUR_MS = 60 * 60 * 1000;

function roundResponseDeadline(roundNumber: number, now = Date.now()): string {
  const configured = new Date(roundNumber === 1 ? RAFFLE.firstRoundDeadline : RAFFLE.secondRoundDeadline).getTime();
  const normal = now + RAFFLE.respondHours * HOUR_MS;
  // The public schedule closes round one at 2 PM and round two at 6 PM ET.
  // If an operational delay starts later, always preserve at least one hour
  // for a real participant decision instead of opening an already-dead form.
  return new Date(Math.max(now + HOUR_MS, Math.min(normal, configured))).toISOString();
}

function participantIdsForPairs(pairs: PairRow[]): string[] {
  return [...new Set(pairs.flatMap((pair) => [pair.user_a_id, pair.user_b_id]))];
}

function unansweredParticipantIds(pairs: PairRow[]): string[] {
  const unanswered = new Set<string>();
  pairs.forEach((pair) => {
    if (pair.a_accepted === null) unanswered.add(pair.user_a_id);
    if (pair.b_accepted === null) unanswered.add(pair.user_b_id);
  });
  return [...unanswered];
}

async function ensureRoundEmails(event: DatingExperimentEvent, round: RoundRow, pairs: PairRow[]): Promise<void> {
  const deadline = new Date(round.response_deadline).getTime();
  if (!Number.isFinite(deadline) || Date.now() >= deadline) return;
  const participants = participantIdsForPairs(pairs);
  await sendDatingExperimentShortlistEmails({
    eventKey: event.event_key,
    roundNumber: round.round_number,
    responseDeadline: round.response_deadline,
    recipientIds: participants,
  });
  if (deadline - Date.now() <= HOUR_MS) {
    await sendDatingExperimentShortlistEmails({
      eventKey: event.event_key,
      roundNumber: round.round_number,
      responseDeadline: round.response_deadline,
      recipientIds: unansweredParticipantIds(pairs),
      reminder: true,
    });
  }
}

async function ensureWinnerEmails(event: DatingExperimentEvent, winners: WinnerRow[]): Promise<void> {
  await sendDatingExperimentWinnerEmails({
    eventKey: event.event_key,
    prizePerPairCents: event.prize_per_pair_cents,
    draws: winners,
  });
}

async function closeExperimentWithoutWinner(
  event: DatingExperimentEvent,
  entrants: number,
  state: 'not-enough' | 'no-eligible-pair',
  winners: WinnerRow[] = [],
): Promise<DrawResult> {
  const now = new Date().toISOString();
  const { error: passEntriesError } = await supabaseAdmin.from('raffle_entries')
    .update({ status: 'passed' })
    .eq('event_key', event.event_key)
    .eq('status', 'entered');
  if (passEntriesError) throw passEntriesError;
  const winnerIds = winners.flatMap((winner) => [winner.user_a_id, winner.user_b_id]);
  if (winnerIds.length) {
    const { error: pickWinnerError } = await supabaseAdmin.from('raffle_entries')
      .update({ status: 'picked' })
      .eq('event_key', event.event_key)
      .in('user_id', winnerIds);
    if (pickWinnerError) throw pickWinnerError;
    await ensureWinnerEmails(event, winners);
  }

  const { error: eventStatusError } = await supabaseAdmin.from('dating_experiment_events')
    .update({ status: 'resolved', updated_at: now })
    .eq('event_key', event.event_key)
    .in('status', ['entry_open', 'entry_closed', 'shortlisting']);
  if (eventStatusError) throw eventStatusError;

  return { ok: true, entrants, drawn: winners.length, state: winners.length ? 'remaining-slot-unfilled' : state };
}

async function resolveCollectingRound(
  event: DatingExperimentEvent,
  round: RoundRow,
  pairs: PairRow[],
): Promise<DrawResult | null> {
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

  const participantIds = participantIdsForPairs(pairs);
  const [{ data: availabilityEntries, error: availabilityError }, { data: winnerRows, error: winnerError }] = await Promise.all([
    supabaseAdmin.from('raffle_entries')
      .select('user_id, questionnaire, notify')
      .eq('event_key', event.event_key)
      .in('user_id', participantIds),
    supabaseAdmin.from('raffle_draws')
      .select('id, user_a_id, user_b_id, winner_slot, restaurant, happens_at')
      .eq('event_key', event.event_key)
      .eq('status', 'both_accepted')
      .order('winner_slot', { ascending: true }),
  ]);
  if (availabilityError) throw availabilityError;
  if (winnerError) throw winnerError;
  const existingWinners = (winnerRows ?? []) as WinnerRow[];
  const eventSlotKeys = event.dinner_dates.map((slot) => slot.slot_key);
  const eventSlotSet = new Set(eventSlotKeys);
  const slotKeyForTime = new Map(event.dinner_dates
    .filter((slot) => slot.starts_at)
    .map((slot) => [new Date(slot.starts_at!).toISOString(), slot.slot_key]));
  const availabilityByUser = new Map((availabilityEntries ?? []).map((entry: any) => [
    entry.user_id,
    Array.isArray(entry.questionnaire?.availableSlotKeys)
      ? [...new Set(entry.questionnaire.availableSlotKeys.map(String).filter((key: string) => eventSlotSet.has(key)))] as string[]
      : [],
  ]));
  const notificationsEnabled = new Set((availabilityEntries ?? [])
    .filter((entry: any) => entry.notify !== false)
    .map((entry: any) => entry.user_id));
  const decisionEdges: SlotAwareDecisionEdge<string>[] = pairs.map((pair) => ({
    id: pair.id,
    a: pair.user_a_id,
    b: pair.user_b_id,
    score: pair.compatibility_score,
    aAccepted: pair.a_accepted,
    bAccepted: pair.b_accepted,
    aFavorite: pair.a_favorite,
    bFavorite: pair.b_favorite,
    availableSlotKeys: (availabilityByUser.get(pair.user_a_id) ?? [])
      .filter((key) => (availabilityByUser.get(pair.user_b_id) ?? []).includes(key)),
  }));
  const mutual = decisionEdges.filter((pair) => pair.aAccepted === true && pair.bAccepted === true);
  const eventSelectionWeight = (score: number) => pairSelectionWeight(score, event.minimum_pair_score);
  const recordedPairIds = round.selected_pair_ids?.length
    ? round.selected_pair_ids
    : pairs
      .filter((pair) => pair.status === 'selected')
      .sort((a, b) => (a.winner_slot ?? 99) - (b.winner_slot ?? 99))
      .map((pair) => pair.id);
  let selected: SlotAwareDecisionEdge<string>[] = recordedPairIds
    .map((pairId) => decisionEdges.find((edge) => edge.id === pairId))
    .filter((pair): pair is SlotAwareDecisionEdge<string> => pair != null);
  const existingWinnerByPair = new Map(existingWinners.map((winner) => [pairKey(winner.user_a_id, winner.user_b_id), winner]));
  const committedSelectionIds = new Set(selected
    .filter((edge) => existingWinnerByPair.has(pairKey(edge.a, edge.b)))
    .map((edge) => edge.id));
  const priorWinners = existingWinners.filter((winner) => !selected.some((edge) => pairKey(edge.a, edge.b) === pairKey(winner.user_a_id, winner.user_b_id)));
  const priorSlotKeys = new Set(priorWinners.flatMap((winner) => {
    if (!winner.happens_at) return [];
    const key = slotKeyForTime.get(new Date(winner.happens_at).toISOString());
    return key ? [key] : [];
  }));
  const availableSlotKeys = eventSlotKeys.filter((key) => !priorSlotKeys.has(key));
  let slotAssignments = recordedPairIds.length ? assignDinnerSlots(selected, availableSlotKeys) : null;
  if (recordedPairIds.length && selected.length !== recordedPairIds.length) {
    throw new Error('Recorded Dating Experiment winners do not match the active shortlist.');
  }
  if (recordedPairIds.length && !slotAssignments) {
    throw new Error('Recorded Dating Experiment winners cannot be assigned to their shared dinner times.');
  }
  if (!recordedPairIds.length) {
    const remainingWinnerCapacity = Math.max(0, event.winner_pair_limit - existingWinners.length);
    const randomValues = Array.from(
      { length: remainingWinnerCapacity },
      () => randomInt(0, 1_000_000_000) / 1_000_000_000,
    );
    let randomIndex = 0;
    slotAssignments = selectMutualDinnerPairsForSlots(
      decisionEdges,
      remainingWinnerCapacity,
      availableSlotKeys,
      eventSelectionWeight,
      () => randomValues[randomIndex++] ?? randomValues[randomValues.length - 1],
    );
    selected = slotAssignments.map((assignment) => assignment.edge);
    const firstSelectionPool = mutualWinnerSelectionPool(mutual, remainingWinnerCapacity);
    const totalSelectionWeight = firstSelectionPool.reduce((sum, pair) => sum + mutualSelectionWeight(pair, eventSelectionWeight), 0);
    const { error: auditError } = await supabaseAdmin.from('dating_experiment_rounds').update({
      selection_random_value: randomValues[0],
      selection_random_values: randomValues,
      selection_weight_total: totalSelectionWeight,
      selected_pair_ids: selected.map((pair) => pair.id),
    }).eq('id', round.id).eq('status', 'resolving');
    if (auditError) throw auditError;
  }
  const slotKeyByPairId = new Map((slotAssignments ?? []).map((assignment) => [assignment.edge.id, assignment.slotKey]));
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
        .eq('event_key', event.event_key)
        .in('user_id', participantIds);
      if (entriesError) throw entriesError;
      for (const entry of entries ?? []) {
        const nextStatus = (entry.attempts ?? 0) < event.max_attempts ? 'entered' : 'passed';
        const { error: entryStatusError } = await supabaseAdmin.from('raffle_entries')
          .update({ status: nextStatus })
          .eq('event_key', event.event_key)
          .eq('user_id', entry.user_id);
        if (entryStatusError) throw entryStatusError;
      }
    }
    if (round.round_number >= event.max_attempts) {
      return closeExperimentWithoutWinner(event, participantIds.length, 'no-eligible-pair', existingWinners);
    }
    return { ok: true, entrants: participantIds.length, drawn: 0, state: 'no-mutual-pair', roundNumber: round.round_number };
  }

  const selectedSlotById = new Map(selected.map((pair) => {
    const slotKey = slotKeyByPairId.get(pair.id);
    const eventSlotIndex = event.dinner_dates.findIndex((slot) => slot.slot_key === slotKey);
    return [pair.id, eventSlotIndex >= 0 ? eventSlotIndex + 1 : null];
  }));
  for (const pair of pairs) {
    const selectedSlot = selectedSlotById.get(pair.id);
    const status = selectedSlot != null
      ? 'selected'
      : pair.a_accepted === true && pair.b_accepted === true
        ? 'not_selected'
        : pair.a_accepted == null || pair.b_accepted == null
          ? 'expired'
          : 'declined';
    const { error: pairStatusError } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
      .update({ status, winner_slot: selectedSlot ?? null })
      .eq('id', pair.id)
      .eq('status', 'pending');
    if (pairStatusError) throw pairStatusError;
  }

  for (const winner of selected) {
    const dinnerDate = event.dinner_dates.find((slot) => slot.slot_key === slotKeyByPairId.get(winner.id));
    if (!dinnerDate) throw new Error('Selected Dating Experiment pair has no shared dinner slot.');
    const winnerSlot = event.dinner_dates.findIndex((slot) => slot.slot_key === dinnerDate.slot_key) + 1;
    if (winnerSlot < 1) throw new Error('Selected Dating Experiment pair has an invalid winner slot.');
    const { error: drawError } = await supabaseAdmin.from('raffle_draws').upsert({
      event_key: event.event_key,
      user_a_id: winner.a,
      user_b_id: winner.b,
      compatibility_score: winner.score,
      a_accepted: true,
      b_accepted: true,
      status: 'both_accepted',
      winner_slot: winnerSlot,
      restaurant: dinnerDate?.venue_details ?? event.winner_fulfillment_details ?? RAFFLE.restaurant,
      happens_at: dinnerDate?.starts_at ?? event.happens_at,
      algorithm_version: event.algorithm_version,
      eligible_pair_count: mutual.length,
      selection_weight: mutualSelectionWeight(winner, eventSelectionWeight),
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

  const { data: allWinnerRows, error: allWinnerError } = await supabaseAdmin.from('raffle_draws')
    .select('id, user_a_id, user_b_id, winner_slot, restaurant, happens_at')
    .eq('event_key', event.event_key)
    .eq('status', 'both_accepted')
    .order('winner_slot', { ascending: true });
  if (allWinnerError) throw allWinnerError;
  const allWinners = (allWinnerRows ?? []) as WinnerRow[];
  const allWinnerIds = new Set(allWinners.flatMap((winner) => [winner.user_a_id, winner.user_b_id]));
  const { data: participantEntries, error: participantEntriesError } = await supabaseAdmin.from('raffle_entries')
    .select('user_id, attempts')
    .eq('event_key', event.event_key)
    .in('user_id', participantIds);
  if (participantEntriesError) throw participantEntriesError;
  for (const entry of participantEntries ?? []) {
    const status = allWinnerIds.has(entry.user_id)
      ? 'picked'
      : (entry.attempts ?? 0) < event.max_attempts ? 'entered' : 'passed';
    const { error: entryStatusError } = await supabaseAdmin.from('raffle_entries')
      .update({ status })
      .eq('event_key', event.event_key)
      .eq('user_id', entry.user_id);
    if (entryStatusError) throw entryStatusError;
  }

  const winnerIds = selected.flatMap((pair) => [pair.a, pair.b]);
  const { data: winnerUsers, error: winnerUsersError } = await supabaseAdmin.from('users')
    .select('id, name')
    .in('id', winnerIds);
  if (winnerUsersError) throw winnerUsersError;
  const nameById = new Map((winnerUsers ?? []).map((user) => [user.id, user.name]));
  const message = {
    title: "It's a date! ✦",
    body: `You chose each other. Open the Dating Experiment for the $${event.prize_per_pair_cents / 100} dinner details.`,
    url: '/dating-experiment',
    tag: `dating-experiment-winner-${round.id}`,
  };
  await Promise.allSettled(winnerIds
    .filter((id) => !selected.some((edge) => committedSelectionIds.has(edge.id) && (edge.a === id || edge.b === id)))
    .filter((id) => notificationsEnabled.has(id))
    .map((id) => sendPushToUser(id, message)));
  await ensureWinnerEmails(event, allWinners);
  const selectedSummaries = selected.map((pair) => ({
    a: nameById.get(pair.a) ?? 'Participant A',
    b: nameById.get(pair.b) ?? 'Participant B',
    score: pair.score,
  }));
  const winnerCapacityFilled = allWinners.length >= event.winner_pair_limit;
  const eventComplete = winnerCapacityFilled || round.round_number >= event.max_attempts;
  if (eventComplete) {
    const { error: passEntriesError } = await supabaseAdmin.from('raffle_entries')
      .update({ status: 'passed' })
      .eq('event_key', event.event_key)
      .eq('status', 'entered');
    if (passEntriesError) throw passEntriesError;
    const { error: eventStatusError } = await supabaseAdmin.from('dating_experiment_events')
      .update({ status: 'resolved', updated_at: now })
      .eq('event_key', event.event_key)
      .eq('status', 'shortlisting');
    if (eventStatusError) throw eventStatusError;
  }
  return {
    ok: true,
    entrants: participantIds.length,
    drawn: selected.length,
    state: eventComplete
      ? winnerCapacityFilled
        ? selected.length === 1 ? 'mutual-pair-selected' : 'mutual-pairs-selected'
        : 'remaining-slot-unfilled'
      : 'partial-mutual-pair-selected',
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
  const event = await getDatingExperimentEvent();
  if (!event) return { ok: true, entrants: 0, drawn: 0, state: 'paused' };
  if (event.status === 'entry_open' && Date.now() >= new Date(event.entry_closes_at).getTime()) {
    const { error: closeError } = await supabaseAdmin.from('dating_experiment_events')
      .update({ status: 'entry_closed', updated_at: new Date().toISOString() })
      .eq('event_key', event.event_key)
      .eq('status', 'entry_open');
    if (closeError) throw closeError;
    event.status = 'entry_closed';
  }

  const { data: won, error: wonError } = await supabaseAdmin.from('raffle_draws')
    .select('id, user_a_id, user_b_id, winner_slot, restaurant, happens_at')
    .eq('event_key', event.event_key)
    .eq('status', 'both_accepted')
    .order('winner_slot', { ascending: true });
  if (wonError) throw wonError;
  const existingWinners = (won ?? []) as WinnerRow[];
  if (existingWinners.length) await ensureWinnerEmails(event, existingWinners);

  const { data: activeRound, error: activeRoundError } = await supabaseAdmin.from('dating_experiment_rounds')
    .select('id, round_number, response_deadline, status, resolution_started_at, selected_pair_ids')
    .eq('event_key', event.event_key)
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
    await ensureRoundEmails(event, activeRound as RoundRow, (activePairs ?? []) as PairRow[]);
    return (await resolveCollectingRound(event, activeRound as RoundRow, (activePairs ?? []) as PairRow[]))!;
  }

  if (existingWinners.length >= event.winner_pair_limit) {
    // Idempotently converge entry bookkeeping if a prior run committed the
    // winner rows immediately before a process interruption.
    const { error: passEntriesError } = await supabaseAdmin.from('raffle_entries')
      .update({ status: 'passed' })
      .eq('event_key', event.event_key)
      .in('status', ['entered', 'picked']);
    if (passEntriesError) throw passEntriesError;
    const winnerIds = existingWinners.flatMap((winner) => [winner.user_a_id, winner.user_b_id]);
    const { error: pickWinnerError } = await supabaseAdmin.from('raffle_entries')
      .update({ status: 'picked' })
      .eq('event_key', event.event_key)
      .in('user_id', winnerIds);
    if (pickWinnerError) throw pickWinnerError;
    const { error: eventStatusError } = await supabaseAdmin.from('dating_experiment_events')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .eq('event_key', event.event_key)
      .eq('status', 'shortlisting');
    if (eventStatusError) throw eventStatusError;
    return { ok: true, entrants: 0, drawn: existingWinners.length, state: 'winner-locked' };
  }

  // Closing entries freezes the pool; it does not authorize an overnight
  // shortlist. The public morning window gives participants a real chance to
  // see and answer their private options during waking hours. Admin force is
  // still available for an explicitly supervised recovery.
  if (!force && Date.now() < new Date(RAFFLE.shortlistAt).getTime()) {
    return { ok: true, entrants: 0, drawn: 0, state: 'waiting-for-morning-shortlist' };
  }

  // `force` may start an already launch-ready experiment before its normal
  // cap/deadline trigger, but it must never bypass the code, database, or
  // operational launch gates. Active rounds are still recoverable above.
  if (!datingExperimentCanShortlist(event)) return { ok: true, entrants: 0, drawn: 0, state: 'paused' };

  const [{ data: priorRounds }, { count: totalEntries }, { data: entries }] = await Promise.all([
    supabaseAdmin.from('dating_experiment_rounds').select('round_number').eq('event_key', event.event_key).order('round_number', { ascending: false }),
    supabaseAdmin.from('raffle_entries').select('user_id', { count: 'exact', head: true })
      .eq('event_key', event.event_key)
      .eq('terms_version', event.terms_version)
      .neq('status', 'withdrawn'),
    supabaseAdmin.from('raffle_entries')
      .select('user_id, attempts, questionnaire, terms_version, notify')
      .eq('event_key', event.event_key)
      .eq('status', 'entered'),
  ]);
  const existingWinnerIds = new Set(existingWinners.flatMap((winner) => [winner.user_a_id, winner.user_b_id]));
  const eligibleEntries = (entries ?? []).filter((entry: any) =>
    (entry.attempts ?? 0) < event.max_attempts
    && entry.terms_version === event.terms_version
    && !existingWinnerIds.has(entry.user_id),
  );
  const eligibleIds = eligibleEntries.map((entry: any) => entry.user_id);
  const naturallyTriggered = Date.now() >= new Date(event.entry_closes_at).getTime()
    || event.status === 'entry_closed'
    || event.status === 'shortlisting'
    || (totalEntries ?? 0) >= event.entry_cap
    || (priorRounds?.length ?? 0) > 0;
  const canStart = force || naturallyTriggered;
  if (!canStart) return { ok: true, entrants: eligibleIds.length, drawn: 0, state: 'waiting-for-trigger' };
  if (eligibleIds.length < 2) {
    return naturallyTriggered
      ? closeExperimentWithoutWinner(event, eligibleIds.length, 'not-enough', existingWinners)
      : { ok: true, entrants: eligibleIds.length, drawn: 0, state: 'not-enough' };
  }

  const [{ data: usersData }, { data: priorPairs }] = await Promise.all([
    supabaseAdmin.from('users').select(COLS).in('id', eligibleIds),
    supabaseAdmin.from('dating_experiment_shortlist_pairs').select('user_a_id, user_b_id').eq('event_key', event.event_key),
  ]);
  const entryByUser = new Map(eligibleEntries.map((entry: any) => [entry.user_id, entry]));
  const seenPairs = new Set<string>((priorPairs ?? []).map((pair: any) => pairKey(pair.user_a_id, pair.user_b_id)));
  const pool: any[] = ((usersData as any[]) ?? [])
    .filter((user) => user.is_test !== true && user.photo_url && user.archetype && raffleEligible(user, {
      centerZip: event.center_zip,
      radiusMiles: Number(event.radius_miles),
    }))
    .map((user) => {
      const experimentAnswers = (entryByUser.get(user.id) as any)?.questionnaire ?? null;
      const preferences = resolveExperimentPreferences(user, experimentAnswers);
      return {
        ...user,
        gender: preferences.gender,
        orientation: preferences.orientation,
        seeking_genders: preferences.seekingGenders,
        age_min: preferences.ageMin,
        age_max: preferences.ageMax,
        experiment_answers: experimentAnswers,
      };
    })
    .filter((user) => user.gender && user.orientation && user.seeking_genders.length && user.age_min != null && user.age_max != null);

  const candidates: { a: any; b: any; score: number }[] = [];
  const usedTimes = new Set(existingWinners.flatMap((winner) => winner.happens_at ? [new Date(winner.happens_at).toISOString()] : []));
  const activeSlotKeys = new Set(event.dinner_dates
    .filter((slot) => !slot.starts_at || !usedTimes.has(new Date(slot.starts_at).toISOString()))
    .map((slot) => slot.slot_key));
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      if (seenPairs.has(pairKey(a.id, b.id))) continue;
      if (!reciprocalExperimentGenderMatch(a, b) || !reciprocalExperimentAgeMatch(a, b)) continue;
      const aSlots = Array.isArray(a.experiment_answers?.availableSlotKeys)
        ? a.experiment_answers.availableSlotKeys.map(String).filter((key: string) => activeSlotKeys.has(key))
        : [];
      const bSlots = new Set(Array.isArray(b.experiment_answers?.availableSlotKeys)
        ? b.experiment_answers.availableSlotKeys.map(String).filter((key: string) => activeSlotKeys.has(key))
        : []);
      if (!aSlots.some((key: string) => bSlots.has(key))) continue;
      const score = raffleScore(a, b);
      if (score >= event.minimum_pair_score) candidates.push({ a, b, score });
    }
  }
  const shortlist = buildCoverageFirstShortlist(candidates, event.shortlist_max_options);
  if (!shortlist.length) {
    return naturallyTriggered
      ? closeExperimentWithoutWinner(event, pool.length, 'no-eligible-pair', existingWinners)
      : { ok: true, entrants: pool.length, drawn: 0, state: 'no-eligible-pair' };
  }

  const roundNumber = ((priorRounds ?? [])[0]?.round_number ?? 0) + 1;
  const responseDeadline = roundResponseDeadline(roundNumber);
  const { data: round, error: roundError } = await supabaseAdmin.from('dating_experiment_rounds').insert({
    event_key: event.event_key,
    round_number: roundNumber,
    status: 'collecting',
    response_deadline: responseDeadline,
    algorithm_version: event.algorithm_version,
    eligible_user_count: pool.length,
    offered_pair_count: shortlist.length,
  }).select('id').single();
  if (roundError) {
    if (roundError.code === '23505') return { ok: true, entrants: pool.length, drawn: 0, state: 'awaiting-shortlist-response' };
    throw roundError;
  }
  const { error: eventStatusError } = await supabaseAdmin.from('dating_experiment_events')
    .update({ status: 'shortlisting', updated_at: new Date().toISOString() })
    .eq('event_key', event.event_key)
    .in('status', ['entry_open', 'entry_closed', 'shortlisting']);
  if (eventStatusError) throw eventStatusError;

  const rows = shortlist.map((edge) => ({
    round_id: round.id,
    event_key: event.event_key,
    user_a_id: edge.a.id,
    user_b_id: edge.b.id,
    compatibility_score: edge.score,
  }));
  const { data: insertedPairs, error: pairError } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
    .insert(rows)
    .select('id, user_a_id, user_b_id, compatibility_score, a_accepted, b_accepted, a_favorite, b_favorite, status, winner_slot');
  if (pairError) {
    await supabaseAdmin.from('dating_experiment_rounds').update({ status: 'cancelled', resolved_at: new Date().toISOString() }).eq('id', round.id);
    throw pairError;
  }

  const participants = [...new Set(shortlist.flatMap((edge) => [edge.a.id, edge.b.id]))];
  for (const id of participants) {
    const currentAttempts = (entryByUser.get(id) as any)?.attempts ?? 0;
    const { error: entryPickError } = await supabaseAdmin.from('raffle_entries')
      .update({ attempts: currentAttempts + 1, status: 'picked' })
      .eq('event_key', event.event_key)
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
    if ((entryByUser.get(id) as any)?.notify === false) return Promise.resolve(false);
    const count = optionCount.get(id) ?? 1;
    return sendPushToUser(id, {
      title: `Your private shortlist is ready ✦`,
      body: `Meet ${count === 1 ? 'your strongest option' : 'your two strongest options'} and privately choose yes or pass before the response window closes.`,
      url: '/dating-experiment',
      tag: `dating-experiment-shortlist-${round.id}`,
    });
  }));
  await ensureRoundEmails(event, {
    id: round.id,
    round_number: roundNumber,
    response_deadline: responseDeadline,
    status: 'collecting',
  }, (insertedPairs ?? []) as PairRow[]);

  return {
    ok: true,
    entrants: pool.length,
    drawn: shortlist.length,
    state: 'shortlist-created',
    roundNumber,
    shortlist: shortlist.map((edge) => ({ a: edge.a.name, b: edge.b.name, score: edge.score })),
  };
}
