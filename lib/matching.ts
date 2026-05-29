/**
 * Matching: HEXACO-based compatibility scoring and adaptive thresholds.
 *
 * Score formula uses all six dimensions with research-informed weights:
 *  - Agreeableness: heaviest — similarity strongly predicts relationship satisfaction
 *  - Honesty-Humility, Conscientiousness: heavy — trust + reliability
 *  - Emotionality, Openness: moderate
 *  - Extraversion: light — complement is fine here
 *
 * Per the existing data model, each dimension's max raw score is ~16 points
 * (4 questions × 4 points each).
 */

const W = {
  honesty: 2.0,
  agreeableness: 2.5,
  conscientiousness: 2.0,
  emotionality: 1.0,
  openness: 1.0,
  extraversion: 0.5,
} as const;

const DIM_MAX_DIFF = 16; // points

// Sum of weights × max per-dim diff = absolute worst case
const MAX_WEIGHTED_DIFF =
  DIM_MAX_DIFF *
  (W.honesty + W.agreeableness + W.conscientiousness + W.emotionality + W.openness + W.extraversion);

const HEXACO_WEIGHT = 0.8;
const VIBES_WEIGHT = 0.2;

const VIBE_KEYS = ['chronotype', 'date_freq', 'future', 'comm', 'social', 'risk'] as const;
const VIBE_MAX_DIFF_PER_KEY = 3; // each key on a 1..4 scale → max |diff| = 3

function hexacoSubscore(a: any, b: any): number {
  const dH = Math.abs((a.score_honesty ?? 0) - (b.score_honesty ?? 0));
  const dA = Math.abs((a.score_agreeableness ?? 0) - (b.score_agreeableness ?? 0));
  const dC = Math.abs((a.score_conscientiousness ?? 0) - (b.score_conscientiousness ?? 0));
  const dE = Math.abs((a.score_emotionality ?? 0) - (b.score_emotionality ?? 0));
  const dO = Math.abs((a.score_openness ?? 0) - (b.score_openness ?? 0));
  const dX = Math.abs((a.score_extraversion ?? 0) - (b.score_extraversion ?? 0));

  const weighted =
    dH * W.honesty +
    dA * W.agreeableness +
    dC * W.conscientiousness +
    dE * W.emotionality +
    dO * W.openness +
    dX * W.extraversion;

  return 100 - (weighted / MAX_WEIGHTED_DIFF) * 100;
}

function vibesSubscore(a: any, b: any): number | null {
  const av = a?.vibes;
  const bv = b?.vibes;
  if (!av || !bv || typeof av !== 'object' || typeof bv !== 'object') return null;

  let totalDiff = 0;
  let maxDiff = 0;
  for (const k of VIBE_KEYS) {
    const aVal = av[k];
    const bVal = bv[k];
    if (typeof aVal !== 'number' || typeof bVal !== 'number') continue;
    totalDiff += Math.abs(aVal - bVal);
    maxDiff += VIBE_MAX_DIFF_PER_KEY;
  }
  if (maxDiff === 0) return null;
  return 100 - (totalDiff / maxDiff) * 100;
}

export function compatibilityScore(a: any, b: any): number {
  const hexaco = hexacoSubscore(a, b);
  const vibes = vibesSubscore(a, b);

  // If either side hasn't filled the vibes quiz, fall back to pure HEXACO.
  const blended = vibes === null
    ? hexaco
    : hexaco * HEXACO_WEIGHT + vibes * VIBES_WEIGHT;

  return Math.round(blended);
}

/**
 * Pool balancing — return the min score required to match for a given requester.
 *
 * When the pool is skewed toward one gender, the over-represented side gets a
 * higher bar: they only match when the compatibility is genuinely high. The
 * scarce side gets a normal bar so they're matched quickly.
 *
 * Pools below `minPoolForRebalance` skip the rebalance to avoid noisy thresholds.
 */
export function thresholdFor(
  user: { gender?: string | null },
  pool: Array<{ gender?: string | null }>,
  opts?: {
    base?: number;
    strict?: number;
    overrepRatio?: number;
    minPoolForRebalance?: number;
    waitDays?: number;
  }
): number {
  const base = opts?.base ?? 50;
  const strict = opts?.strict ?? 65;
  const overrepRatio = opts?.overrepRatio ?? 0.55;
  const minPool = opts?.minPoolForRebalance ?? 10;

  // Gender-balance bar (existing behavior).
  let threshold = base;
  if (user.gender === 'm' || user.gender === 'f') {
    const binary = pool.filter((p) => p.gender === 'm' || p.gender === 'f');
    if (binary.length >= minPool) {
      const same = binary.filter((p) => p.gender === user.gender).length;
      const ratio = same / binary.length;
      if (ratio >= overrepRatio) threshold = strict;
    }
  }

  // Wait-time decay: the longer someone has sat unmatched, the more we relax
  // the bar so they don't rot in the pool. ~1.5 pts/day, capped, with a hard
  // floor so match quality never fully collapses. Pairs with continuous
  // matching — fresh users keep a high bar, long-waiters gradually loosen.
  const waitDays = opts?.waitDays ?? 0;
  const FLOOR = 35;
  const MAX_DECAY = 18;
  const decay = Math.min(Math.max(waitDays, 0) * 1.5, MAX_DECAY);
  return Math.max(FLOOR, threshold - decay);
}
