/**
 * Love matching V3.1: auditable multi-signal compatibility plus adaptive
 * thresholds. Core values and connection style lead; personality, rhythms,
 * interests, and relationship expectations add supporting evidence. The score
 * never uses message contents or an LLM.
 *
 * Core quiz v2 scores each HEXACO dimension out of 8 points
 * (2 questions × 4 points each).
 */
import { zipDistanceMiles, DEFAULT_MATCH_RADIUS } from './quiz-data.ts';
import { intentOf, intentCompatible, equityBonus } from './pools.ts';

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
  const diff = (x: any, y: any) => Math.min(DIM_MAX_DIFF, Math.abs((x ?? 0) - (y ?? 0)));
  const dH = diff(a.score_honesty, b.score_honesty);
  const dA = diff(a.score_agreeableness, b.score_agreeableness);
  const dC = diff(a.score_conscientiousness, b.score_conscientiousness);
  const dE = diff(a.score_emotionality, b.score_emotionality);
  const dO = diff(a.score_openness, b.score_openness);
  const dX = diff(a.score_extraversion, b.score_extraversion);

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

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item.trim())
    : [];
}

function normalizedSet(values: unknown[]): Set<string> {
  return new Set(values.flatMap(stringList).map((item) => item.trim().toLowerCase()));
}

// Shared interests are a positive conversation signal, not a hard similarity
// requirement. Free-text vocabularies are sparse, so zero exact overlap stays
// near-neutral while one or more real overlaps get a meaningful lift.
function interestSubscore(a: any, b: any): number | null {
  const aSet = normalizedSet([a?.music, a?.food, a?.hobbies, a?.sports]);
  const bSet = normalizedSet([b?.music, b?.food, b?.hobbies, b?.sports]);
  if (aSet.size === 0 || bSet.size === 0) return null;
  let shared = 0;
  for (const item of aSet) if (bSet.has(item)) shared++;
  if (shared === 0) return 45;
  if (shared === 1) return 72;
  if (shared === 2) return 88;
  return 100;
}

function overlapScore(a: unknown, b: unknown): number | null {
  const aa = new Set(stringList(a));
  const bb = new Set(stringList(b));
  if (aa.size === 0 || bb.size === 0) return null;
  let intersection = 0;
  for (const value of aa) if (bb.has(value)) intersection++;
  return intersection / new Set([...aa, ...bb]).size;
}

function ordinalSimilarity(a: unknown, b: unknown, order: string[]): number | null {
  const ai = order.indexOf(String(a));
  const bi = order.indexOf(String(b));
  if (ai < 0 || bi < 0) return null;
  return 1 - Math.abs(ai - bi) / Math.max(1, order.length - 1);
}

// The deep quiz stores relationship expectations under values_profile.partner.
// This is not treated as proof of chemistry; it is a light alignment signal for
// pace, social energy, and what both people want a relationship to feel like.
function relationshipPreferenceSubscore(a: any, b: any): number | null {
  const ap = a?.values_profile?.partner;
  const bp = b?.values_profile?.partner;
  if (!ap || !bp || typeof ap !== 'object' || typeof bp !== 'object') return null;
  const values = [
    ordinalSimilarity(ap.pace, bp.pace, ['slow', 'steady', 'fast']),
    ordinalSimilarity(ap.energy, bp.energy, ['home', 'balanced', 'social']),
    overlapScore(ap.draws, bp.draws),
    overlapScore(ap.priority, bp.priority),
  ].filter((value): value is number => value != null);
  return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length) * 100 : null;
}

// V3.1 stays content-based and auditable. Behavioral reciprocity is applied as
// a small reranking adjustment outside this score, never allowed to override a
// dealbreaker or turn the LLM into the matching engine.
const V31_WEIGHTS = {
  values: 0.30,
  attachment: 0.24,
  traits: 0.12,
  vibes: 0.10,
  rapid: 0.06,
  interests: 0.10,
  relationshipPreferences: 0.08,
} as const;

export const MATCHING_ALGORITHM_VERSION = 'love-v3.1';

export type CompatibilityReasonCode =
  | 'values'
  | 'connection_style'
  | 'daily_rhythm'
  | 'personality'
  | 'shared_interests'
  | 'relationship_pace';

export type CompatibilityBreakdown = {
  score: number;
  confidence: number;
  reasonCodes: CompatibilityReasonCode[];
  reasons: string[];
  signalScores: Record<string, number | null>;
  hardConflicts: string[];
};

export function hardDealbreakerConflicts(a: any, b: any): string[] {
  const aKids = a?.values_profile?.kids;
  const bKids = b?.values_profile?.kids;
  const conflicts: string[] = [];
  if ((aKids === 'yes' && bKids === 'no') || (aKids === 'no' && bKids === 'yes')) {
    conflicts.push('kids');
  }
  return conflicts;
}

export function hasHardDealbreakerConflict(a: any, b: any): boolean {
  return hardDealbreakerConflicts(a, b).length > 0;
}

export function compatibilityBreakdown(a: any, b: any): CompatibilityBreakdown {
  const signals = {
    values: valuesSubscore(a, b),
    attachment: attachmentSubscore(a, b),
    traits: hexacoSubscore(a, b),
    vibes: vibesSubscore(a, b),
    rapid: rapidSubscore(a, b),
    interests: interestSubscore(a, b),
    relationshipPreferences: relationshipPreferenceSubscore(a, b),
  };
  let sum = 0;
  let weight = 0;
  for (const [key, value] of Object.entries(signals)) {
    if (value == null) continue;
    const signalWeight = V31_WEIGHTS[key as keyof typeof V31_WEIGHTS];
    sum += signalWeight * value;
    weight += signalWeight;
  }

  const candidates: Array<{ code: CompatibilityReasonCode; label: string; score: number | null }> = [
    { code: 'values', label: 'your core values line up', score: signals.values },
    { code: 'connection_style', label: 'your connection styles look compatible', score: signals.attachment },
    { code: 'daily_rhythm', label: 'your day-to-day rhythms fit', score: signals.vibes },
    { code: 'personality', label: 'your personalities have an easy overlap', score: signals.traits },
    { code: 'shared_interests', label: 'you have real interests in common', score: signals.interests },
    { code: 'relationship_pace', label: 'you want a similar relationship pace', score: signals.relationshipPreferences },
  ];
  const strongest = candidates
    .filter((item) => item.score != null && item.score >= 60)
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
    .slice(0, 2);
  if (strongest.length === 0) {
    strongest.push({ code: 'personality', label: 'your overall profiles complement each other', score: signals.traits });
  }

  return {
    score: Math.round(weight > 0 ? sum / weight : signals.traits),
    confidence: Math.round(weight * 100) / 100,
    reasonCodes: strongest.map((item) => item.code),
    reasons: strongest.map((item) => item.label),
    signalScores: signals,
    hardConflicts: hardDealbreakerConflicts(a, b),
  };
}

export function compatibilityScore(a: any, b: any): number {
  return compatibilityBreakdown(a, b).score;
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
  // `b` is canonical for "anyone". Accept the historical `both` value too so
  // older profiles and experiment entries cannot silently lose valid matches.
  const wantsAnyone = (seeking: unknown) => seeking === 'b' || seeking === 'both';
  const userWantsCand = wantsAnyone(user.seeking) || user.seeking === candidate.gender;
  const candWantsUser = wantsAnyone(candidate.seeking) || candidate.seeking === user.gender;
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
  opts: { waitDays?: number; nowMs?: number; candidateAdjustments?: Map<string, number> },
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
    .filter((p) => !hasHardDealbreakerConflict(user, p))
    .map((p) => ({ user: p, score: compatibilityScore(user, p) }))
    .filter((c) => c.score >= minScore)
    .map((c) => ({
      ...c,
      eff: c.score + equityBonus(c.user.last_matched_at, nowMs) + (opts.candidateAdjustments?.get(c.user.id) ?? 0),
    }));

  const sameIntent = clearing.filter((c) => intentCompatible(uIntent, intentOf(c.user))).sort((a, b) => b.eff - a.eff);
  const rest = clearing.filter((c) => !intentCompatible(uIntent, intentOf(c.user))).sort((a, b) => b.eff - a.eff);

  return { ranked: [...sameIntent, ...rest], minScore };
}
