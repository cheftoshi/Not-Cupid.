import type { RankedCandidate } from '@/lib/matching';

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim().toLowerCase()).filter(Boolean)
    : [];
}

function interests(user: any): Set<string> {
  return new Set([
    ...strings(user?.music), ...strings(user?.food), ...strings(user?.hobbies), ...strings(user?.sports),
  ]);
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const value of left) if (right.has(value)) overlap++;
  return overlap / (left.size + right.size - overlap);
}

function profileSimilarity(left: any, right: any): number {
  const traitFields = ['score_extraversion', 'score_openness', 'score_conscientiousness'] as const;
  const traitValues = traitFields.flatMap((field) => {
    const a = left?.[field];
    const b = right?.[field];
    return typeof a === 'number' && typeof b === 'number' ? [1 - Math.min(8, Math.abs(a - b)) / 8] : [];
  });
  const traitSimilarity = traitValues.length
    ? traitValues.reduce((sum, value) => sum + value, 0) / traitValues.length
    : 0;
  return 0.6 * traitSimilarity + 0.4 * jaccard(interests(left), interests(right));
}

// Maximal-marginal-relevance reranking. Compatibility remains dominant while a
// small penalty prevents a roster made entirely of near-identical lifestyles.
// Protected attributes (gender, race, sexuality, age) never participate.
export function diversifyLoveRanking(
  candidates: RankedCandidate[],
  limit = 10,
  diversityWeight = 0.12,
): RankedCandidate[] {
  if (candidates.length <= 1 || limit <= 1) return candidates.slice(0, Math.max(0, limit));
  const remaining = [...candidates];
  const selected: RankedCandidate[] = [remaining.shift()!];
  while (selected.length < limit && remaining.length > 0) {
    let bestIndex = 0;
    let bestValue = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];
      const maxSimilarity = Math.max(...selected.map((prior) => profileSimilarity(candidate.user, prior.user)));
      const value = candidate.eff - diversityWeight * 100 * maxSimilarity;
      if (value > bestValue || (value === bestValue && candidate.eff > remaining[bestIndex].eff)) {
        bestIndex = index;
        bestValue = value;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  return selected;
}

export type SignalPreference = { reasonCode: string; adjustment: number; evidenceCount: number };

export function adaptiveReasonAdjustment(reasonCodes: string[], preferences: SignalPreference[]): number {
  if (!reasonCodes.length || !preferences.length) return 0;
  const byCode = new Map(preferences.map((item) => [item.reasonCode, item]));
  const evidence = reasonCodes.flatMap((code) => {
    const item = byCode.get(code);
    return item && item.evidenceCount >= 2 ? [Math.max(-2, Math.min(2, item.adjustment))] : [];
  });
  if (!evidence.length) return 0;
  return Math.max(-2, Math.min(2, evidence.reduce((sum, value) => sum + value, 0) / evidence.length));
}
