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
import { intentOf, intentCompatible, equityBonus } from './pools';

const W = {
  honesty: 2.0,
  agreeableness: 2.5,
  conscientiousness: 2.0,
  emotionality: 1.0,
  openness: 1.0,
  extraversion: 0.5,
} as const;

const DIM_MAX_DIFF = 8; // points (HEXACO trimmed to 2 questions/dim × 4 pts = max 8)

// Sum of weights × max per-dim diff = absolute worst case
const MAX_WEIGHTED_DIFF =
  DIM_MAX_DIFF *
  (W.honesty + W.agreeableness + W.conscientiousness + W.emotionality + W.openness + W.extraversion);

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

// ─── v2 subscores: attachment compatibility + values alignment ───────────────
// Both return 0..100, or null when either side lacks the data (old/v1 users) so
// compatibilityScore can renormalize over whatever signals are present.

// Attachment: reward security, heavily penalize the anxious×avoidant
// "chase–withdraw" pairing — the combination meta-analyses flag as worst.
function attachmentSubscore(a: any, b: any): number | null {
  const aAnx = a?.attach_anxiety, aAvo = a?.attach_avoidance;
  const bAnx = b?.attach_anxiety, bAvo = b?.attach_avoidance;
  if ([aAnx, aAvo, bAnx, bAvo].some((v) => typeof v !== 'number')) return null;
  const insecurity = (aAnx + aAvo + bAnx + bAvo) / 4 / 100;            // 0..1, lower = more secure
  const trap = ((aAnx * bAvo) + (bAnx * aAvo)) / (2 * 100 * 100);       // 0..1, anxious↔avoidant risk
  const score = 100 * (1 - 0.4 * insecurity - 0.6 * trap);
  return Math.max(0, Math.min(100, score));
}

// Kids is the heaviest values term (closest thing to a dealbreaker); the rest
// (faith/politics/ambition/lifestyle/substances) are similarity on a 0..3 scale.
function kidsCompat(a: any, b: any): number | null {
  if (a == null || b == null) return null;
  if (a === b) return 1;                       // yes=yes, no=no, maybe=maybe, have=have
  const s = new Set([a, b]);
  if (s.has('maybe')) return 0.6;              // maybe is flexible with anything
  if (s.has('yes') && s.has('no')) return 0;   // hard conflict
  if (s.has('have') && s.has('no')) return 0.7;
  if (s.has('have') && s.has('yes')) return 0.45;
  return 0.5;
}
const VAL_NUM_KEYS = ['faith', 'politics', 'ambition', 'lifestyle', 'fitness'] as const;
const SUBSTANCE_ORD: Record<string, number> = { none: 0, rare: 1, social: 2, regular: 3 };
function valuesSubscore(a: any, b: any): number | null {
  const av = a?.values_profile, bv = b?.values_profile;
  if (!av || !bv || typeof av !== 'object' || typeof bv !== 'object') return null;
  let sum = 0, wsum = 0;
  const add = (w: number, sim: number | null) => { if (sim != null) { sum += w * sim; wsum += w; } };
  add(0.35, kidsCompat(av.kids, bv.kids));
  for (const k of VAL_NUM_KEYS) {
    if (typeof av[k] === 'number' && typeof bv[k] === 'number') add(0.13, 1 - Math.abs(av[k] - bv[k]) / 3);
  }
  const aS = SUBSTANCE_ORD[av.substances], bS = SUBSTANCE_ORD[bv.substances];
  if (aS != null && bS != null) add(0.13, 1 - Math.abs(aS - bS) / 3);
  if (wsum === 0) return null;
  return (sum / wsum) * 100;
}

// Rapid fire ⚡ — light this-or-that overlap (stored in vibes.rapid). Fraction of
// shared answers that match. Low weight; pure delight + a small nudge.
function rapidSubscore(a: any, b: any): number | null {
  const ar = a?.vibes?.rapid, br = b?.vibes?.rapid;
  if (!ar || !br || typeof ar !== 'object' || typeof br !== 'object') return null;
  let same = 0, n = 0;
  for (const k of Object.keys(ar)) {
    if (typeof br[k] === 'number' && typeof ar[k] === 'number') { n++; if (ar[k] === br[k]) same++; }
  }
  return n === 0 ? null : (same / n) * 100;
}

// v2 weights (cold-start: no behavioral/reciprocity term yet — that blends in
// later). Values lead, attachment next, traits + vibes + rapid light. Weights
// are renormalized over whichever signals both users actually have.
const V2_WEIGHTS = { values: 0.38, attachment: 0.27, traits: 0.13, vibes: 0.12, rapid: 0.10 } as const;

export function compatibilityScore(a: any, b: any): number {
  const parts: Array<[number, number | null]> = [
    [V2_WEIGHTS.values, valuesSubscore(a, b)],
    [V2_WEIGHTS.attachment, attachmentSubscore(a, b)],
    [V2_WEIGHTS.traits, hexacoSubscore(a, b)],
    [V2_WEIGHTS.vibes, vibesSubscore(a, b)],
    [V2_WEIGHTS.rapid, rapidSubscore(a, b)],
  ];
  let sum = 0, wsum = 0;
  for (const [w, v] of parts) { if (v != null) { sum += w * v; wsum += w; } }
  // hexacoSubscore is never null, so wsum >= traits weight; guard anyway.
  return Math.round(wsum > 0 ? sum / wsum : hexacoSubscore(a, b));
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
