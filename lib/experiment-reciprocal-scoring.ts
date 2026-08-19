import { compatibilityBreakdown } from './matching.ts';

/**
 * Dating Experiment V5: an explainable reciprocal ranking score.
 *
 * The first live experiment showed that the broad Love compatibility score was
 * too compressed to rank a tiny shortlist well. Three signals separated yes
 * from pass in both rounds: values alignment, attachment compatibility, and
 * shared interests. V5 therefore uses those stable signals as its foundation.
 * It does not score photos, names, race, gender, message content, or inferred
 * attraction. Gender, age, schedule and location stay explicit hard filters in
 * the experiment pool before this scorer runs.
 */
export const EXPERIMENT_RECIPROCAL_ALGORITHM_VERSION = 'dating-experiment-reciprocal-choice-v5';

export const EXPERIMENT_RECIPROCAL_WEIGHTS = {
  values: 0.40,
  attachment: 0.35,
  sharedInterests: 0.25,
} as const;

const CHOICE_HISTORY_MINIMUM = 3;
const CHOICE_HISTORY_WEIGHT = 0.05;

export type ExperimentReciprocalScore = {
  score: number;
  directedA: number;
  directedB: number;
  confidence: number;
  eligible: boolean;
  components: {
    values: number | null;
    attachment: number | null;
    sharedInterests: number | null;
    choiceAffinityA: number | null;
    choiceAffinityB: number | null;
    contextOnly: {
      broadCompatibility: number;
      relationshipPreferences: number | null;
      experimentIntent: number | null;
    };
  };
  hardConflicts: string[];
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item.trim())
    : [];
}

function interestSet(user: any): Set<string> {
  return new Set(
    [user?.music, user?.food, user?.hobbies, user?.sports]
      .flatMap(strings)
      .map((value) => value.trim().toLowerCase()),
  );
}

// Exact free-text vocabularies are sparse. No overlap is neutral rather than a
// rejection; real overlap gets a strong, explainable conversation lift.
function sharedInterestScore(a: any, b: any): number | null {
  const aSet = interestSet(a);
  const bSet = interestSet(b);
  if (!aSet.size || !bSet.size) return null;
  let shared = 0;
  for (const value of aSet) if (bSet.has(value)) shared += 1;
  if (shared === 0) return 45;
  if (shared === 1) return 72;
  if (shared === 2) return 88;
  return 100;
}

function experimentIntentScore(a: any, b: any): number | null {
  const aa = a?.experiment_answers;
  const bb = b?.experiment_answers;
  if (!aa?.intention || !bb?.intention || !aa?.energy || !bb?.energy) return null;
  const intention = aa.intention === bb.intention
    ? 100
    : aa.intention === 'open' || bb.intention === 'open'
      ? 85
      : 50;
  const energy = aa.energy === bb.energy ? 100 : 65;
  const planning = !aa.planningStyle || !bb.planningStyle
    ? 75
    : aa.planningStyle === bb.planningStyle
      ? 100
      : aa.planningStyle === 'flexible' || bb.planningStyle === 'flexible'
        ? 90
        : 55;
  return intention * 0.50 + energy * 0.30 + planning * 0.20;
}

function foundationComponents(a: any, b: any) {
  const broad = compatibilityBreakdown(a, b);
  return {
    broad,
    values: broad.signalScores.values,
    attachment: broad.signalScores.attachment,
    sharedInterests: sharedInterestScore(a, b),
  };
}

function weightedFoundation(input: {
  values: number | null;
  attachment: number | null;
  sharedInterests: number | null;
}): { score: number; evidenceWeight: number } {
  const parts: Array<{ value: number; weight: number }> = [];
  if (input.values != null) parts.push({ value: input.values, weight: EXPERIMENT_RECIPROCAL_WEIGHTS.values });
  if (input.attachment != null) parts.push({ value: input.attachment, weight: EXPERIMENT_RECIPROCAL_WEIGHTS.attachment });
  if (input.sharedInterests != null) parts.push({ value: input.sharedInterests, weight: EXPERIMENT_RECIPROCAL_WEIGHTS.sharedInterests });
  const evidenceWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (!parts.length) return { score: 50, evidenceWeight: 0 };
  return {
    score: clamp(parts.reduce((sum, part) => sum + part.value * part.weight, 0) / evidenceWeight),
    evidenceWeight,
  };
}

/**
 * Learn only after three explicit positive choices. This prevents one early
 * selection from stereotyping a participant. A pass is deliberately never a
 * negative training label because the reason is unknown.
 */
function explicitChoiceAffinity(candidate: any, positiveChoices: any[]): number | null {
  if (positiveChoices.length < CHOICE_HISTORY_MINIMUM) return null;
  const scores = positiveChoices.map((positive) => weightedFoundation(foundationComponents(candidate, positive)).score);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}

function directedScore(foundation: number, affinity: number | null): number {
  if (affinity == null) return foundation;
  return clamp(foundation * (1 - CHOICE_HISTORY_WEIGHT) + affinity * CHOICE_HISTORY_WEIGHT);
}

function harmonicMean(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  return (2 * a * b) / (a + b);
}

export function experimentReciprocalScore(
  a: any,
  b: any,
  options: { positiveChoicesForA?: any[]; positiveChoicesForB?: any[] } = {},
): ExperimentReciprocalScore {
  const components = foundationComponents(a, b);
  const foundation = weightedFoundation(components);
  const affinityA = explicitChoiceAffinity(b, options.positiveChoicesForA ?? []);
  const affinityB = explicitChoiceAffinity(a, options.positiveChoicesForB ?? []);
  const directedA = directedScore(foundation.score, affinityA);
  const directedB = directedScore(foundation.score, affinityB);
  const hardConflicts = components.broad.hardConflicts;
  return {
    score: hardConflicts.length ? 0 : Math.round(harmonicMean(directedA, directedB)),
    directedA: Math.round(directedA),
    directedB: Math.round(directedB),
    confidence: Math.round(foundation.evidenceWeight * 100) / 100,
    eligible: hardConflicts.length === 0,
    components: {
      values: components.values,
      attachment: components.attachment,
      sharedInterests: components.sharedInterests,
      choiceAffinityA: affinityA == null ? null : Math.round(affinityA),
      choiceAffinityB: affinityB == null ? null : Math.round(affinityB),
      // Retained for explanations and offline evaluation, not V5 ranking.
      // The first live sample did not support giving these a ranking weight.
      contextOnly: {
        broadCompatibility: components.broad.score,
        relationshipPreferences: components.broad.signalScores.relationshipPreferences,
        experimentIntent: experimentIntentScore(a, b),
      },
    },
    hardConflicts,
  };
}
