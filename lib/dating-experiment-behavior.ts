export type ExperimentDecisionReason = {
  code: string;
  label: string;
  decision: 'yes' | 'pass';
};

export const EXPERIMENT_DECISION_REASONS: ExperimentDecisionReason[] = [
  { code: 'values_intent', label: 'their values and intentions felt aligned', decision: 'yes' },
  { code: 'shared_interests', label: 'we had things I’d genuinely talk about', decision: 'yes' },
  { code: 'profile_story', label: 'their profile made me curious', decision: 'yes' },
  { code: 'open_to_chemistry', label: 'I’d rather test the chemistry in person', decision: 'yes' },
  { code: 'chemistry_fit', label: 'I wasn’t feeling the fit', decision: 'pass' },
  { code: 'relationship_intent', label: 'our relationship intentions felt different', decision: 'pass' },
  { code: 'age_distance', label: 'age or distance didn’t feel right', decision: 'pass' },
  { code: 'profile_detail', label: 'I needed more profile detail', decision: 'pass' },
  { code: 'timing', label: 'the timing or dinner plan didn’t work', decision: 'pass' },
  { code: 'other', label: 'another private reason', decision: 'pass' },
];

export function experimentReasonsFor(decision: boolean) {
  return EXPERIMENT_DECISION_REASONS.filter((reason) => reason.decision === (decision ? 'yes' : 'pass'));
}

export function isExperimentDecisionReason(code: unknown, decision: boolean) {
  return typeof code === 'string'
    && experimentReasonsFor(decision).some((reason) => reason.code === code);
}

type PairRow = {
  id: string;
  round_id: string;
  compatibility_score: number | null;
  user_a_id: string;
  user_b_id: string;
  a_accepted: boolean | null;
  b_accepted: boolean | null;
  a_responded_at?: string | null;
  b_responded_at?: string | null;
  created_at: string;
};

type ParticipantEventRow = { round_id: string; user_id: string; event_type: string };
type FeedbackRow = { decision: boolean; reason_code: string };

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function summarizeDatingExperimentBehavior(
  pairs: PairRow[],
  participantEvents: ParticipantEventRow[],
  feedback: FeedbackRow[],
) {
  const offersByUser = new Map<string, Array<{ accepted: boolean | null; score: number | null; respondedAt?: string | null; createdAt: string }>>();
  for (const pair of pairs) {
    const add = (userId: string, accepted: boolean | null, respondedAt?: string | null) => {
      const current = offersByUser.get(userId) ?? [];
      current.push({ accepted, score: pair.compatibility_score, respondedAt, createdAt: pair.created_at });
      offersByUser.set(userId, current);
    };
    add(pair.user_a_id, pair.a_accepted, pair.a_responded_at);
    add(pair.user_b_id, pair.b_accepted, pair.b_responded_at);
  }

  const offeredUsers = [...offersByUser.keys()];
  const viewed = new Set(participantEvents.filter((row) => row.event_type === 'shortlist_viewed').map((row) => row.user_id));
  const responded = offeredUsers.filter((userId) => (offersByUser.get(userId) ?? []).every((offer) => offer.accepted !== null));
  const anyYes = responded.filter((userId) => (offersByUser.get(userId) ?? []).some((offer) => offer.accepted === true));
  const allPass = responded.filter((userId) => (offersByUser.get(userId) ?? []).every((offer) => offer.accepted === false));
  const responseTimes: number[] = [];
  const yesScores: number[] = [];
  const passScores: number[] = [];
  for (const offers of offersByUser.values()) {
    for (const offer of offers) {
      if (offer.respondedAt) responseTimes.push(new Date(offer.respondedAt).getTime() - new Date(offer.createdAt).getTime());
      if (offer.accepted === true && offer.score != null) yesScores.push(offer.score);
      if (offer.accepted === false && offer.score != null) passScores.push(offer.score);
    }
  }
  const average = (values: number[]) => values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : null;
  const reasonCounts = feedback.reduce<Record<string, number>>((counts, row) => {
    counts[row.reason_code] = (counts[row.reason_code] ?? 0) + 1;
    return counts;
  }, {});
  const unresolved = pairs.filter((pair) => pair.a_accepted === null || pair.b_accepted === null).length;
  const mutualYes = pairs.filter((pair) => pair.a_accepted === true && pair.b_accepted === true).length;
  const oneSidedYes = pairs.filter((pair) =>
    (pair.a_accepted === true && pair.b_accepted === false)
    || (pair.a_accepted === false && pair.b_accepted === true)
  ).length;
  const bothPass = pairs.filter((pair) => pair.a_accepted === false && pair.b_accepted === false).length;
  const responseRate = percent(responded.length, offeredUsers.length);
  const yesUserRate = percent(anyYes.length, responded.length);
  const reciprocalRate = percent(mutualYes, mutualYes + oneSidedYes);
  const viewingMeasurementStarted = viewed.size > 0;

  let diagnosis = 'Keep collecting behavior before changing the model; this cohort is still small.';
  if (viewingMeasurementStarted && percent(viewed.size, offeredUsers.length)! < 60) {
    diagnosis = 'The main leak is reach: too many offered people never opened their shortlist.';
  } else if (viewingMeasurementStarted && percent(responded.length, viewed.size)! < 70) {
    diagnosis = 'People are opening but not sealing choices; simplify the decision screen or shorten the response loop.';
  } else if (responded.length >= 6 && (yesUserRate ?? 100) < 45) {
    diagnosis = 'People are responding but passing; candidate fit, profile detail, or dinner logistics need work.';
  } else if ((mutualYes + oneSidedYes) >= 4 && (reciprocalRate ?? 100) < 35) {
    diagnosis = 'Interest is mostly one-way; reciprocal ranking and pool composition are the current matching bottleneck.';
  } else if (mutualYes > 0) {
    diagnosis = 'The funnel is producing mutual interest; focus next on confirmation, attendance, and post-date quality.';
  }

  return {
    offeredUsers: offeredUsers.length,
    viewedUsers: viewed.size,
    respondedUsers: responded.length,
    anyYesUsers: anyYes.length,
    allPassUsers: allPass.length,
    nonresponders: offeredUsers.length - responded.length,
    responseRatePct: responseRate,
    yesUserRatePct: yesUserRate,
    viewRatePct: viewingMeasurementStarted ? percent(viewed.size, offeredUsers.length) : null,
    viewingMeasurementStarted,
    pairs: { total: pairs.length, mutualYes, oneSidedYes, bothPass, unresolved, reciprocalRatePct: reciprocalRate },
    scoreSignals: { averageYes: average(yesScores), averagePass: average(passScores) },
    medianResponseMinutes: median(responseTimes) == null ? null : Math.round((median(responseTimes) as number) / 60000),
    feedback: {
      submittedUsers: new Set(participantEvents.filter((row) => row.event_type === 'feedback_submitted').map((row) => row.user_id)).size,
      skippedUsers: new Set(participantEvents.filter((row) => row.event_type === 'feedback_skipped').map((row) => row.user_id)).size,
      reasons: reasonCounts,
    },
    diagnosis,
    notes: [
      'A pass is separate from a non-response; one-sided interest is separate from mutual interest.',
      'Reason feedback is optional, private, structured, and used only in aggregate.',
      'Shortlist-view measurement begins with this release; historical views are intentionally not inferred.',
    ],
  };
}
