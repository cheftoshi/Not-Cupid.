import { compatibilityBreakdown } from '@/lib/matching';

export const LOVE_COMPATIBILITY_READ_VERSION = 'ai-connect-read-v1-2026-08-18';

export type TraitBand = 'leans lower' | 'middle range' | 'leans higher';

export type LoveCompatibilityTrait = {
  key: string;
  label: string;
  focus: string;
  candidateBand: TraitBand;
  pairDynamic: string;
};

export type LoveCompatibilityRead = {
  version: string;
  firstName: string;
  headline: string;
  overview: string;
  traits: LoveCompatibilityTrait[];
  strengths: string[];
  watchouts: string[];
  firstDateIdea: string;
  source: 'ai' | 'curated';
  disclosure: string;
};

type TraitDefinition = {
  key: string;
  field: string;
  label: string;
  focus: string;
};

const TRAITS: TraitDefinition[] = [
  { key: 'honesty', field: 'score_honesty', label: 'Honesty–Humility', focus: 'sincerity, fairness and modesty' },
  { key: 'emotionality', field: 'score_emotionality', label: 'Emotionality', focus: 'emotional sensitivity and closeness' },
  { key: 'extraversion', field: 'score_extraversion', label: 'Extraversion', focus: 'social energy and outward expression' },
  { key: 'agreeableness', field: 'score_agreeableness', label: 'Agreeableness', focus: 'patience and forgiveness during friction' },
  { key: 'conscientiousness', field: 'score_conscientiousness', label: 'Conscientiousness', focus: 'structure, planning and follow-through' },
  { key: 'openness', field: 'score_openness', label: 'Openness', focus: 'curiosity, creativity and comfort with newness' },
];

const finiteScore = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  ? Math.max(0, Math.min(8, value))
  : 4;

function traitBand(score: number): TraitBand {
  if (score <= 3) return 'leans lower';
  if (score >= 6) return 'leans higher';
  return 'middle range';
}

function sentence(value: string): string {
  const trimmed = value.trim().replace(/[.]+$/, '');
  return trimmed ? `${trimmed[0].toUpperCase()}${trimmed.slice(1)}.` : '';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim())
    : [];
}

export type CompatibilityReadContext = {
  firstName: string;
  score: number;
  reasons: string[];
  sharedInterests: string[];
  traits: LoveCompatibilityTrait[];
  aiTraits: Array<{
    dimension: string;
    candidateBand: TraitBand;
    viewerBand: TraitBand;
    relationship: 'similar range' | 'candidate leans higher' | 'viewer leans higher';
  }>;
};

export function compatibilityReadContext(viewer: any, candidate: any): CompatibilityReadContext {
  const firstName = String(candidate?.name || 'this person').split(' ')[0].slice(0, 50);
  const breakdown = compatibilityBreakdown(viewer, candidate);
  const traits = TRAITS.map((trait) => {
    const viewerScore = finiteScore(viewer?.[trait.field]);
    const candidateScore = finiteScore(candidate?.[trait.field]);
    const difference = candidateScore - viewerScore;
    const pairDynamic = Math.abs(difference) <= 1.5
      ? `You land in a similar range on ${trait.focus}.`
      : difference > 0
        ? `${firstName} leans more toward ${trait.focus}; ask how that shows up day to day.`
        : `You lean more toward ${trait.focus}; treat the difference as a conversation prompt, not a verdict.`;
    return {
      key: trait.key,
      label: trait.label,
      focus: trait.focus,
      candidateBand: traitBand(candidateScore),
      pairDynamic,
    };
  });
  const aiTraits = TRAITS.map((trait) => {
    const viewerScore = finiteScore(viewer?.[trait.field]);
    const candidateScore = finiteScore(candidate?.[trait.field]);
    const difference = candidateScore - viewerScore;
    return {
      dimension: trait.label,
      candidateBand: traitBand(candidateScore),
      viewerBand: traitBand(viewerScore),
      relationship: Math.abs(difference) <= 1.5
        ? 'similar range' as const
        : difference > 0
          ? 'candidate leans higher' as const
          : 'viewer leans higher' as const,
    };
  });
  const viewerInterests = new Set([
    ...stringList(viewer?.music), ...stringList(viewer?.food),
    ...stringList(viewer?.hobbies), ...stringList(viewer?.sports),
  ].map((item) => item.toLowerCase()));
  const sharedInterests = Array.from(new Set([
    ...stringList(candidate?.music), ...stringList(candidate?.food),
    ...stringList(candidate?.hobbies), ...stringList(candidate?.sports),
  ].filter((item) => viewerInterests.has(item.toLowerCase())))).slice(0, 4);
  return {
    firstName,
    score: breakdown.score,
    reasons: breakdown.reasons.slice(0, 2),
    sharedInterests,
    traits,
    aiTraits,
  };
}

export function curatedCompatibilityRead(context: CompatibilityReadContext): LoveCompatibilityRead {
  const strengths = context.reasons.length
    ? context.reasons.map(sentence).filter(Boolean).slice(0, 2)
    : ['Your overall profiles leave enough common ground to explore.', 'A real conversation will tell you more than a score can.'];
  while (strengths.length < 2) strengths.push('There is room to learn how the fit feels in real life.');
  const contrastTraits = context.traits.filter((trait) => !trait.pairDynamic.startsWith('You land in a similar range'));
  const watchouts = contrastTraits.slice(0, 2).map((trait) => sentence(trait.pairDynamic));
  while (watchouts.length < 2) {
    watchouts.push('No major trait contrast stands out here—stay curious about pace and communication in practice.');
  }
  const shared = context.sharedInterests[0];
  return {
    version: LOVE_COMPATIBILITY_READ_VERSION,
    firstName: context.firstName,
    headline: `${context.firstName}, beyond the match score.`,
    overview: context.reasons.length
      ? `${sentence(context.reasons.join(' and '))} The six signals below show where the fit may feel natural—and what is worth asking about.`
      : 'The six signals below are a starting point for curiosity, not a prediction of chemistry.',
    traits: context.traits,
    strengths,
    watchouts: watchouts.slice(0, 2),
    firstDateIdea: shared
      ? `Use ${shared} as the easy opening: pick one short, public plan around it and leave room to extend the date only if the energy is there.`
      : 'Choose a short, public, low-pressure first plan. Ask one specific question about how they actually spend a good weekend.',
    source: 'curated',
    disclosure: 'Built from the six HEXACO-inspired signals in both NotCupid quizzes. It is not the full research inventory, a diagnosis, or a guarantee. Raw answers and exact scores stay private.',
  };
}

