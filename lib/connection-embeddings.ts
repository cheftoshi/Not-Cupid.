import { createHash } from 'node:crypto';

export const MATCHING_EMBEDDING_CONSENT_VERSION = 'matching-embeddings-openai-v1-2026-08-20';
export const MATCHING_EMBEDDING_INPUT_VERSION = 'connection-profile-v1';
export const EMBEDDING_SHADOW_ALGORITHM_VERSION = 'connection-embedding-shadow-v1';

export type ConnectionIntentScope = 'love' | 'friend';

const SCORE_FIELDS = [
  ['honesty', 'score_honesty'],
  ['emotionality', 'score_emotionality'],
  ['extraversion', 'score_extraversion'],
  ['agreeableness', 'score_agreeableness'],
  ['conscientiousness', 'score_conscientiousness'],
  ['openness', 'score_openness'],
] as const;
const VALUE_FIELDS = ['kids', 'faith', 'politics', 'ambition', 'lifestyle', 'fitness', 'substances'] as const;
const VIBE_FIELDS = ['chronotype', 'date_freq', 'future', 'comm', 'social', 'risk'] as const;
const FRIEND_FIELDS = ['cadence', 'group_size', 'life_stage', 'intent'] as const;

function boundedScalar(value: unknown): string | number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100) / 100;
  if (typeof value !== 'string') return null;
  const clean = value
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[redacted]')
    .replace(/https?:\/\/\S+/gi, '[redacted]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 48);
  return clean || null;
}

function boundedList(value: unknown, limit = 12): Array<string | number> {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.flatMap((item) => {
    const scalar = boundedScalar(item);
    return scalar == null || scalar === '[redacted]' ? [] : [scalar];
  }))).slice(0, limit);
}

function selectedObject(source: unknown, keys: readonly string[]): Record<string, string | number> {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const object = source as Record<string, unknown>;
  const output: Record<string, string | number> = {};
  for (const key of keys) {
    const value = boundedScalar(object[key]);
    if (value != null && value !== '[redacted]') output[key] = value;
  }
  return output;
}

function sortedEntries(value: Record<string, string | number>): string {
  return Object.keys(value).sort().map((key) => `${key}=${value[key]}`).join('; ');
}

// Deliberately excludes names, age, gender, email, ZIP, photos, raw quiz
// answers, biography/prompts and all message content. The representation is a
// deterministic summary of explicit scores and controlled profile choices.
export function connectionEmbeddingInput(user: any, intent: ConnectionIntentScope): string {
  const scores: Record<string, number> = {};
  for (const [label, field] of SCORE_FIELDS) {
    const value = user?.[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      scores[label] = Math.max(0, Math.min(1, Math.round((value / 8) * 1000) / 1000));
    }
  }
  const values = selectedObject(user?.values_profile, VALUE_FIELDS);
  const partner = selectedObject(user?.values_profile?.partner, ['pace', 'energy']);
  const vibes = selectedObject(user?.vibes, VIBE_FIELDS);
  const rapid = selectedObject(user?.vibes?.rapid, Object.keys(user?.vibes?.rapid || {}).sort().slice(0, 20));

  const lines = [
    `connection intent: ${intent}`,
    `personality scores normalized 0 to 1: ${sortedEntries(scores) || 'not provided'}`,
    `values: ${sortedEntries(values) || 'not provided'}`,
    `relationship preferences: ${sortedEntries(partner) || 'not provided'}`,
    `daily rhythms: ${sortedEntries(vibes) || 'not provided'}`,
    `rapid preferences: ${sortedEntries(rapid) || 'not provided'}`,
    `music interests: ${boundedList(user?.music).join(', ') || 'not provided'}`,
    `food interests: ${boundedList(user?.food).join(', ') || 'not provided'}`,
    `hobbies: ${boundedList(user?.hobbies).join(', ') || 'not provided'}`,
    `sports and activities: ${boundedList(user?.sports).join(', ') || 'not provided'}`,
  ];

  if (intent === 'friend') {
    const friend = selectedObject(user?.friend_vibes, FRIEND_FIELDS);
    lines.push(`friendship style: ${sortedEntries(friend) || 'not provided'}`);
    lines.push(`preferred friend activities: ${boundedList(user?.friend_vibes?.activities, 16).join(', ') || 'not provided'}`);
  }

  return lines.join('\n').slice(0, 8_000);
}

export function connectionEmbeddingInputHash(input: string): string {
  return createHash('sha256')
    .update(`${MATCHING_EMBEDDING_INPUT_VERSION}\n${input}`)
    .digest('hex');
}

export function hasMatchingEmbeddingConsent(user: any): boolean {
  return user?.ai_matching_consent_version === MATCHING_EMBEDDING_CONSENT_VERSION
    && !!user?.ai_matching_consent_at
    && !user?.ai_matching_consent_revoked_at;
}

export function topKOverlap(liveIds: string[], shadowIds: string[], k = 10): { count: number; rate: number } {
  const left = liveIds.slice(0, k);
  const right = new Set(shadowIds.slice(0, k));
  const count = left.filter((id) => right.has(id)).length;
  const denominator = Math.max(1, Math.min(k, left.length, shadowIds.length));
  return { count, rate: count / denominator };
}

// Spearman correlation over ids present in both rankings. Null communicates
// that fewer than two shared items cannot produce a meaningful rank measure.
export function sharedRankCorrelation(liveIds: string[], shadowIds: string[]): number | null {
  const shadowRank = new Map(shadowIds.map((id, index) => [id, index + 1]));
  const pairs = liveIds.flatMap((id, index) => {
    const right = shadowRank.get(id);
    return right == null ? [] : [{ left: index + 1, right }];
  });
  const n = pairs.length;
  if (n < 2) return null;
  const squaredDiff = pairs.reduce((sum, pair) => sum + (pair.left - pair.right) ** 2, 0);
  return Math.max(-1, Math.min(1, 1 - (6 * squaredDiff) / (n * (n * n - 1))));
}
