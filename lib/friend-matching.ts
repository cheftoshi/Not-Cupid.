// Friend Maxxin compatibility scorer. DELIBERATELY different from romance:
// friendship is driven by shared activities + similar Openness/Extraversion/
// Agreeableness + compatible lifestyle — NOT by Emotionality complementarity.
//
// Weights (sum 100):
//   activities  40  — shared things to do is the #1 friendship driver
//   hexaco      25  — O + X + A heavy; H/C light; Emotionality ignored
//   lifestyle   20  — cadence + group size alignment
//   life_stage  10  — same phase of life clicks
//   intent       5  — wanting the same kind of friendship

import type { FriendVibes } from '@/lib/friend-quiz';

const HEXACO_MAX = 16;

function jaccard(a: string[] = [], b: string[] = []): number {
  if (!a.length && !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  A.forEach((x) => { if (B.has(x)) inter++; });
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

// Ordinal closeness for scales (cadence, group_size): 1 when equal, decaying
// with distance across the option list.
function ordinalCloseness(av: string | undefined, bv: string | undefined, order: string[]): number {
  if (!av || !bv) return 0.5; // unknown → neutral
  const ai = order.indexOf(av), bi = order.indexOf(bv);
  if (ai < 0 || bi < 0) return 0.5;
  const span = Math.max(1, order.length - 1);
  return 1 - Math.abs(ai - bi) / span;
}

const CADENCE_ORDER = ['most days', 'weekly', 'couple times a month', 'occasionally'];
const GROUP_ORDER = ['1-on-1', 'small (3–5)', 'a big group'];

function hexacoFriendScore(a: any, b: any): number {
  // Similarity (1 - normalized diff) per dimension, weighted toward the
  // dimensions that actually predict friendship.
  const dims: Array<[string, number]> = [
    ['score_openness', 0.30],
    ['score_extraversion', 0.30],
    ['score_agreeableness', 0.22],
    ['score_honesty', 0.10],
    ['score_conscientiousness', 0.08],
    // Emotionality intentionally excluded — irrelevant to platonic fit.
  ];
  let acc = 0, wsum = 0;
  for (const [k, w] of dims) {
    const av = a[k], bv = b[k];
    if (typeof av !== 'number' || typeof bv !== 'number') continue;
    const sim = 1 - Math.abs(av - bv) / HEXACO_MAX;
    acc += sim * w; wsum += w;
  }
  return wsum === 0 ? 0.5 : acc / wsum;
}

export function friendCompatibilityScore(a: any, b: any): number {
  const av: FriendVibes = a.friend_vibes || {};
  const bv: FriendVibes = b.friend_vibes || {};

  const activities = jaccard(av.activities, bv.activities);            // 0..1
  const hexaco = hexacoFriendScore(a, b);                              // 0..1
  const lifestyle =
    0.55 * ordinalCloseness(av.cadence, bv.cadence, CADENCE_ORDER) +
    0.45 * ordinalCloseness(av.group_size, bv.group_size, GROUP_ORDER); // 0..1
  const lifeStage = av.life_stage && bv.life_stage ? (av.life_stage === bv.life_stage ? 1 : 0.3) : 0.5;
  const intent = av.intent && bv.intent ? (av.intent === bv.intent ? 1 : 0.5) : 0.5;

  const score =
    activities * 40 +
    hexaco * 25 +
    lifestyle * 20 +
    lifeStage * 10 +
    intent * 5;

  return Math.round(score);
}

// Mutual gender openness: each must be open to the other's gender (empty = any).
export function friendGenderOk(a: any, b: any): boolean {
  const aOpen: string[] = Array.isArray(a.friend_seeking) ? a.friend_seeking : [];
  const bOpen: string[] = Array.isArray(b.friend_seeking) ? b.friend_seeking : [];
  const aWantsB = aOpen.length === 0 || aOpen.includes(b.gender);
  const bWantsA = bOpen.length === 0 || bOpen.includes(a.gender);
  return aWantsB && bWantsA;
}

export function rankFriendCandidates(user: any, pool: any[]): Array<{ user: any; score: number }> {
  return pool
    .filter((p) => p.id !== user.id && friendGenderOk(user, p))
    .map((p) => ({ user: p, score: friendCompatibilityScore(user, p) }))
    .sort((x, y) => y.score - x.score);
}
