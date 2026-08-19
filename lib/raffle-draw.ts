import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleScore, pairSelectionWeight, raffleEligible } from '@/lib/raffle';
import { sendPushToUser } from '@/lib/push';
import {
  sendDatingExperimentShortlistEmails,
  sendDatingExperimentWaitingEmails,
  sendDatingExperimentWinnerEmails,
} from '@/lib/dating-experiment-email';
import { randomInt } from 'crypto';
import { getAdminEmails } from '@/lib/admin';
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
  buildReciprocalQualityShortlist,
  assignDinnerSlots,
  mutualSelectionWeight,
  mutualWinnerSelectionPool,
  selectMutualDinnerPairsForSlots,
  type SlotAwareDecisionEdge,
} from '@/lib/experiment-shortlist';
import {
  EXPERIMENT_RECIPROCAL_ALGORITHM_VERSION,
  experimentReciprocalScore,
} from '@/lib/experiment-reciprocal-scoring';

const COLS = 'id, name, age, gender, seeking, age_min, age_max, zip, photo_url, archetype, hobbies, music, food, sports, ' +
  'score_honesty, score_emotionality, score_extraversion, score_agreeableness, score_conscientiousness, score_openness, ' +
  'vibes, values_profile, attach_anxiety, attach_avoidance, attach_style, relationship_style, email, is_test, is_blocked, deleted_at';

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

type PriorPairChoice = {
  user_a_id: string;
  user_b_id: string;
  a_accepted: boolean | null;
  b_accepted: boolean | null;
};

async function loadPositiveChoiceProfiles(
  eventKey: string,
  priorPairs: PriorPairChoice[],
): Promise<Map<string, any[]>> {
  const positivePairs = priorPairs.filter((pair) => pair.a_accepted === true || pair.b_accepted === true);
  const participantIds = [...new Set(positivePairs.flatMap((pair) => [pair.user_a_id, pair.user_b_id]))];
  const byUser = new Map<string, any[]>();
  if (!participantIds.length) return byUser;
  const [{ data: profiles, error: profileError }, { data: entries, error: entryError }] = await Promise.all([
    supabaseAdmin.from('users').select(COLS).in('id', participantIds),
    supabaseAdmin.from('raffle_entries').select('user_id, questionnaire').eq('event_key', eventKey).in('user_id', participantIds),
  ]);
  if (profileError) throw profileError;
  if (entryError) throw entryError;
  const questionnaireByUser = new Map((entries ?? []).map((entry: any) => [entry.user_id, entry.questionnaire ?? null]));
  const profileByUser = new Map(((profiles as any[]) ?? []).map((profile) => [profile.id, {
    ...profile,
    experiment_answers: questionnaireByUser.get(profile.id) ?? null,
  }]));
  const add = (userId: string, chosenId: string) => {
    const chosen = profileByUser.get(chosenId);
    if (!chosen) return;
    const current = byUser.get(userId) ?? [];
    if (!current.some((profile) => profile.id === chosen.id)) current.push(chosen);
    byUser.set(userId, current);
  };
  for (const pair of positivePairs) {
    if (pair.a_accepted === true) add(pair.user_a_id, pair.user_b_id);
    if (pair.b_accepted === true) add(pair.user_b_id, pair.user_a_id);
  }
  return byUser;
}

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
  // The public schedule closes round one at 2 PM; the operator may extend a
  // later round through its configured cutoff without shortening real choice time.
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
  const initialDelivery = await sendDatingExperimentShortlistEmails({
    eventKey: event.event_key,
    roundNumber: round.round_number,
    responseDeadline: round.response_deadline,
    recipientIds: participants,
  });
  if (!initialDelivery.approved) {
    throw new Error('Dating Experiment selection email approval is missing');
  }
  if (initialDelivery.failed > 0) {
    throw new Error(`Dating Experiment shortlist email failed for ${initialDelivery.failed} recipient(s)`);
  }
  const waitingRecipients = await eligibleWaitingEntries(event);
  if (waitingRecipients.all.length) {
    const waitingDelivery = await sendDatingExperimentWaitingEmails({
      eventKey: event.event_key,
      roundNumber: round.round_number,
      recipientIds: waitingRecipients.all,
    });
    // This is a separately approved message. Until its copy is approved, the
    // round continues and the PWA remains the source of truth. Once approved,
    // the hourly idempotent recovery sends it exactly once per entrant/round.
    if (waitingDelivery.approved && waitingDelivery.failed > 0) {
      throw new Error(`Dating Experiment waiting-status email failed for ${waitingDelivery.failed} recipient(s)`);
    }
    await ensureWaitingPushNotifications(event, round, waitingRecipients.optedIn);
  }
  if (deadline - Date.now() <= HOUR_MS) {
    const reminderDelivery = await sendDatingExperimentShortlistEmails({
      eventKey: event.event_key,
      roundNumber: round.round_number,
      responseDeadline: round.response_deadline,
      recipientIds: unansweredParticipantIds(pairs),
      reminder: true,
    });
    if (!reminderDelivery.approved) {
      throw new Error('Dating Experiment selection email approval is missing');
    }
    if (reminderDelivery.failed > 0) {
      throw new Error(`Dating Experiment shortlist reminder failed for ${reminderDelivery.failed} recipient(s)`);
    }
    await ensureShortlistReminderPushNotifications(
      event,
      round,
      unansweredParticipantIds(pairs),
    );
  }
}

async function eligibleWaitingEntries(event: DatingExperimentEvent): Promise<{ all: string[]; optedIn: string[] }> {
  const { data: entries, error: entriesError } = await supabaseAdmin.from('raffle_entries')
    .select('user_id, attempts, questionnaire, terms_version, notify')
    .eq('event_key', event.event_key)
    .eq('status', 'entered')
    .eq('terms_version', event.terms_version);
  if (entriesError) throw entriesError;
  const eligibleEntries = (entries ?? []).filter((entry: any) => (entry.attempts ?? 0) < event.max_attempts);
  if (!eligibleEntries.length) return { all: [], optedIn: [] };
  const entryByUser = new Map(eligibleEntries.map((entry: any) => [entry.user_id, entry]));
  const { data: users, error: usersError } = await supabaseAdmin.from('users')
    .select(COLS)
    .in('id', eligibleEntries.map((entry: any) => entry.user_id));
  if (usersError) throw usersError;
  const adminEmails = new Set(getAdminEmails());
  const all = ((users as any[]) ?? [])
    .filter((user) => user.is_test !== true
      && user.is_blocked !== true
      && !user.deleted_at
      && !adminEmails.has(String(user.email || '').trim().toLowerCase())
      && user.photo_url
      && user.archetype
      && raffleEligible(user, { centerZip: event.center_zip, radiusMiles: Number(event.radius_miles) }))
    .map((user) => {
      const preferences = resolveExperimentPreferences(user, (entryByUser.get(user.id) as any)?.questionnaire ?? null);
      return { user, preferences };
    })
    .filter(({ preferences }) => preferences.gender
      && preferences.orientation
      && preferences.seekingGenders.length
      && preferences.ageMin != null
      && preferences.ageMax != null)
    .map(({ user }) => user.id);
  const optedIn = all.filter((id) => (entryByUser.get(id) as any)?.notify !== false);
  return { all, optedIn };
}

async function ensureWaitingPushNotifications(
  event: DatingExperimentEvent,
  round: RoundRow,
  recipientIds: string[],
): Promise<void> {
  await deliverRoundPushNotifications({
    event,
    round,
    recipientIds,
    notificationKey: 'waiting',
    eventName: 'experiment_waiting_push',
    title: 'Your Dating Experiment entry is active ✦',
    body: 'Entries are closed and matching is underway. We’ll let you know if you have someone to review.',
    tag: `dating-experiment-waiting-r${round.round_number}`,
  });
}

async function ensureShortlistReminderPushNotifications(
  event: DatingExperimentEvent,
  round: RoundRow,
  recipientIds: string[],
): Promise<void> {
  if (!recipientIds.length) return;
  const { data: entries, error: entriesError } = await supabaseAdmin.from('raffle_entries')
    .select('user_id, notify')
    .eq('event_key', event.event_key)
    .in('user_id', recipientIds);
  if (entriesError) throw entriesError;
  const optedInIds = (entries ?? []).filter((entry) => entry.notify !== false).map((entry) => entry.user_id);
  await deliverRoundPushNotifications({
    event,
    round,
    recipientIds: optedInIds,
    notificationKey: 'shortlist-reminder',
    eventName: 'experiment_shortlist_reminder_push',
    title: 'Your shortlist closes in one hour',
    body: `Review your private options and choose Yes or Pass by ${deadlineTime(round.response_deadline)}.`,
    tag: `dating-experiment-shortlist-reminder-r${round.round_number}`,
  });
}

async function deliverRoundPushNotifications(args: {
  event: DatingExperimentEvent;
  round: RoundRow;
  recipientIds: string[];
  notificationKey: string;
  eventName: string;
  title: string;
  body: string;
  tag: string;
}): Promise<void> {
  if (!args.recipientIds.length) return;
  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin.from('push_subscriptions')
    .select('user_id')
    .in('user_id', args.recipientIds);
  if (subscriptionsError) throw subscriptionsError;
  const subscribedIds = [...new Set((subscriptions ?? []).map((row) => row.user_id))];
  let delivered = 0;
  for (const userId of subscribedIds) {
    const dedupeKey = `dating-experiment-${args.notificationKey}-push:${args.event.event_key}:r${args.round.round_number}:${userId}`;
    const { error: claimError } = await supabaseAdmin.from('app_client_events').insert({
      user_id: userId,
      event_name: `${args.eventName}_claimed`,
      surface: 'dating_experiment',
      path: '/dating-experiment',
      dedupe_key: dedupeKey,
      metadata: { event_key: args.event.event_key, round_number: args.round.round_number, channel: 'push' },
    });
    if (claimError?.code === '23505') continue;
    if (claimError) throw claimError;
    const pushed = await sendPushToUser(userId, {
      title: args.title,
      body: args.body,
      url: '/dating-experiment',
      tag: args.tag,
    });
    if (pushed) delivered += 1;
    const { error: finishError } = await supabaseAdmin.from('app_client_events').update({
      event_name: pushed ? `${args.eventName}_delivered` : `${args.eventName}_failed`,
      metadata: {
        event_key: args.event.event_key,
        round_number: args.round.round_number,
        channel: 'push',
        delivered: pushed,
      },
    }).eq('dedupe_key', dedupeKey);
    if (finishError) throw finishError;
  }
  console.info('[dating-experiment-round-push]', {
    eventKey: args.event.event_key,
    roundNumber: args.round.round_number,
    notificationKey: args.notificationKey,
    eligible: args.recipientIds.length,
    subscribed: subscribedIds.length,
    delivered,
  });
}

function deadlineTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(new Date(value));
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
  // Eligibility is re-checked at resolution time, not only when the shortlist
  // was created. A safety block or account deletion during the response window
  // must make that pair impossible to select.
  const offeredParticipantIds = participantIdsForPairs(pairs);
  const { data: currentParticipants, error: participantError } = offeredParticipantIds.length
    ? await supabaseAdmin.from('users')
      .select('id, email, is_test, is_blocked, deleted_at')
      .in('id', offeredParticipantIds)
    : { data: [] as any[], error: null };
  if (participantError) throw participantError;
  const adminEmails = new Set(getAdminEmails());
  const eligibleParticipantIds = new Set((currentParticipants ?? [])
    .filter((user: any) => user.is_test !== true
      && user.is_blocked !== true
      && !user.deleted_at
      && !adminEmails.has(String(user.email || '').trim().toLowerCase()))
    .map((user: any) => user.id));
  const ineligibleParticipantIds = new Set(offeredParticipantIds.filter((id) => !eligibleParticipantIds.has(id)));
  if (ineligibleParticipantIds.size) {
    const now = new Date().toISOString();
    for (const pair of pairs) {
      if (!ineligibleParticipantIds.has(pair.user_a_id) && !ineligibleParticipantIds.has(pair.user_b_id)) continue;
      const { error } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
        .update({ status: 'expired', a_accepted: false, b_accepted: false })
        .eq('id', pair.id)
        .eq('status', 'pending');
      if (error) throw error;
      pair.status = 'expired';
      pair.a_accepted = false;
      pair.b_accepted = false;
    }
    const { error: withdrawalError } = await supabaseAdmin.from('raffle_entries')
      .update({ status: 'withdrawn', withdrawn_at: now })
      .eq('event_key', event.event_key)
      .in('user_id', [...ineligibleParticipantIds]);
    if (withdrawalError) throw withdrawalError;
  }
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
        const nextStatus = ineligibleParticipantIds.has(entry.user_id)
          ? 'withdrawn'
          : (entry.attempts ?? 0) < event.max_attempts ? 'entered' : 'passed';
        const { error: entryStatusError } = await supabaseAdmin.from('raffle_entries')
          .update(nextStatus === 'withdrawn' ? { status: nextStatus, withdrawn_at: now } : { status: nextStatus })
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
      : ineligibleParticipantIds.has(entry.user_id)
        ? 'withdrawn'
        : (entry.attempts ?? 0) < event.max_attempts ? 'entered' : 'passed';
    const { error: entryStatusError } = await supabaseAdmin.from('raffle_entries')
      .update(status === 'withdrawn' ? { status, withdrawn_at: now } : { status })
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
export async function drawRaffle(opts: { force?: boolean; chainDepth?: number } = {}): Promise<DrawResult> {
  const force = opts.force === true;
  const chainDepth = Math.max(0, opts.chainDepth ?? 0);
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
    const resolution = (await resolveCollectingRound(event, activeRound as RoundRow, (activePairs ?? []) as PairRow[]))!;
    const shouldStartNextRound = (
      resolution.state === 'no-mutual-pair'
      || resolution.state === 'partial-mutual-pair-selected'
    ) && activeRound.round_number < event.max_attempts;
    // Do not burn an hour between sealed rounds. Once a round has resolved,
    // immediately compose and notify the next round in the same invocation.
    // The depth bound prevents an unexpected state regression from recursing.
    if (shouldStartNextRound && chainDepth < event.max_attempts) {
      return drawRaffle({ force, chainDepth: chainDepth + 1 });
    }
    return resolution;
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

  const [
    { data: priorRounds, error: priorRoundsError },
    { count: totalEntries, error: totalEntriesError },
    { data: entries, error: entriesError },
  ] = await Promise.all([
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
  // The selection snapshot must be complete before any irreversible status
  // change. A transient read failure is not an empty pool: fail closed and let
  // the next idempotent cron retry with a coherent snapshot.
  if (priorRoundsError) throw priorRoundsError;
  if (totalEntriesError) throw totalEntriesError;
  if (entriesError) throw entriesError;
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

  const [
    { data: usersData, error: usersError },
    { data: priorPairs, error: priorPairsError },
  ] = await Promise.all([
    supabaseAdmin.from('users').select(COLS).in('id', eligibleIds),
    supabaseAdmin.from('dating_experiment_shortlist_pairs')
      .select('user_a_id, user_b_id, a_accepted, b_accepted')
      .eq('event_key', event.event_key),
  ]);
  if (usersError) throw usersError;
  if (priorPairsError) throw priorPairsError;
  const entryByUser = new Map(eligibleEntries.map((entry: any) => [entry.user_id, entry]));
  const adminEmails = new Set(getAdminEmails());
  const seenPairs = new Set<string>((priorPairs ?? []).map((pair: any) => pairKey(pair.user_a_id, pair.user_b_id)));
  const pool: any[] = ((usersData as any[]) ?? [])
    .filter((user) => user.is_test !== true
      && user.is_blocked !== true
      && !user.deleted_at
      && !adminEmails.has(String(user.email || '').trim().toLowerCase())
      && user.photo_url
      && user.archetype
      && raffleEligible(user, {
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

  // V5 is opt-in at the event/version level. The first live experiment stays
  // on its accepted V4 rules until an explicitly consented rescue or a future
  // event switches the database algorithm_version. That keeps active sealed
  // decisions historically accurate while the new model is production-ready.
  const positiveChoicesByUser = event.algorithm_version === EXPERIMENT_RECIPROCAL_ALGORITHM_VERSION
    ? await loadPositiveChoiceProfiles(event.event_key, (priorPairs ?? []) as PriorPairChoice[])
    : new Map<string, any[]>();

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
      if (event.algorithm_version === EXPERIMENT_RECIPROCAL_ALGORITHM_VERSION) {
        const reciprocal = experimentReciprocalScore(a, b, {
          positiveChoicesForA: positiveChoicesByUser.get(a.id) ?? [],
          positiveChoicesForB: positiveChoicesByUser.get(b.id) ?? [],
        });
        if (reciprocal.eligible && reciprocal.score >= event.minimum_pair_score) {
          candidates.push({ a, b, score: reciprocal.score });
        }
      } else {
        const score = raffleScore(a, b);
        if (score >= event.minimum_pair_score) candidates.push({ a, b, score });
      }
    }
  }
  const shortlist = event.algorithm_version === EXPERIMENT_RECIPROCAL_ALGORITHM_VERSION
    ? buildReciprocalQualityShortlist(candidates, event.shortlist_max_options)
    : buildCoverageFirstShortlist(candidates, event.shortlist_max_options);
  if (!shortlist.length) {
    return naturallyTriggered
      ? closeExperimentWithoutWinner(event, pool.length, 'no-eligible-pair', existingWinners)
      : { ok: true, entrants: pool.length, drawn: 0, state: 'no-eligible-pair' };
  }

  const roundNumber = ((priorRounds ?? [])[0]?.round_number ?? 0) + 1;
  const responseDeadline = roundResponseDeadline(roundNumber);
  const rows = shortlist.map((edge) => ({
    user_a_id: edge.a.id,
    user_b_id: edge.b.id,
    compatibility_score: edge.score,
  }));
  const { data: roundId, error: roundError } = await supabaseAdmin.rpc(
    'create_dating_experiment_shortlist_round',
    {
      p_event_key: event.event_key,
      p_round_number: roundNumber,
      p_response_deadline: responseDeadline,
      p_algorithm_version: event.algorithm_version,
      p_eligible_user_count: pool.length,
      p_pairs: rows,
    },
  );
  if (roundError) {
    if (roundError.code === '23505') return { ok: true, entrants: pool.length, drawn: 0, state: 'awaiting-shortlist-response' };
    throw roundError;
  }
  if (typeof roundId !== 'string') throw new Error('Dating Experiment shortlist did not return a round ID.');
  const { data: insertedPairs, error: pairError } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
    .select('id, user_a_id, user_b_id, compatibility_score, a_accepted, b_accepted, a_favorite, b_favorite, status, winner_slot')
    .eq('round_id', roundId);
  if (pairError) throw pairError;

  const participants = [...new Set(shortlist.flatMap((edge) => [edge.a.id, edge.b.id]))];
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
      tag: `dating-experiment-shortlist-${roundId}`,
    });
  }));
  await ensureRoundEmails(event, {
    id: roundId,
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
