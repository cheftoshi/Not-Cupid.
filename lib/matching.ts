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
import { zipDistanceMiles, DEFAULT_MATCH_RADIUS } from './quiz-data';
import { intentOf, intentCompatible } from './pools';
import { equityBonus } from './balance';

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

// ─── Shared candidate eligibility + ranking ──────────────────────────────────
// One place that turns a raw waiting-pool into ranked, eligible candidates —
// used by BOTH the single auto-match (/api/match → ranked[0]) and the curated
// roster (/api/match/roster → ranked.slice(0,N)), so they always agree.

export function isGenderMatch(user: any, candidate: any): boolean {
  const userWantsCand = user.seeking === 'b' || user.seeking === candidate.gender;
  const candWantsUser = candidate.seeking === 'b' || candidate.seeking === user.gender;
  return userWantsCand && candWantsUser;
}

export function isWithinRadius(zip1: string, zip2: string, radiusMiles: number): boolean {
  const dist = zipDistanceMiles(zip1, zip2);
  if (dist === null) return true; // unknown coords pass through, same as the matcher
  return dist <= radiusMiles;
}

export interface RankedCandidate {
  user: any;
  score: number;
  eff: number; // score + equity bonus (the ranking key)
}

export interface RankResult {
  ranked: RankedCandidate[];
  minScore: number;
}

// Pure: user + raw waiting pool → ranked eligible candidates. Mirrors the
// /api/match filter chain exactly: gender → age → radius → ENM cluster →
// score threshold (with wait decay) → equity rank, same-intent floated first.
export function rankCandidates(
  user: any,
  pool: any[],
  opts: { waitDays?: number; nowMs?: number },
): RankResult {
  const nowMs = opts.nowMs ?? Date.now();
  const radiusMiles = user.match_radius ?? DEFAULT_MATCH_RADIUS;

  const genderCompatible = pool.filter((p) => isGenderMatch(user, p));
  const ageCompatible = genderCompatible.filter(
    (p) => user.age >= p.age_min && user.age <= p.age_max && p.age >= user.age_min && p.age <= user.age_max,
  );
  const locationCompatible = ageCompatible.filter((p) => isWithinRadius(user.zip, p.zip, radiusMiles));

  const uIntent = intentOf(user);
  const clusterCompatible = locationCompatible.filter((p) => {
    const pIntent = intentOf(p);
    if (uIntent === 'enm' || pIntent === 'enm') return uIntent === 'enm' && pIntent === 'enm';
    return true;
  });

  const minScore = thresholdFor(user, pool, { waitDays: opts.waitDays });
  const clearing = clusterCompatible
    .map((p) => ({ user: p, score: compatibilityScore(user, p) }))
    .filter((c) => c.score >= minScore)
    .map((c) => ({ ...c, eff: c.score + equityBonus(c.user.last_matched_at, nowMs) }));

  const sameIntent = clearing.filter((c) => intentCompatible(uIntent, intentOf(c.user))).sort((a, b) => b.eff - a.eff);
  const rest = clearing.filter((c) => !intentCompatible(uIntent, intentOf(c.user))).sort((a, b) => b.eff - a.eff);

  return { ranked: [...sameIntent, ...rest], minScore };
}
