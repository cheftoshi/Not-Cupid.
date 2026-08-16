export type ExperimentProfileInput = {
  age?: number | null;
  photo_url?: string | null;
  archetype?: string | null;
  score_honesty?: number | null;
  bio?: string | null;
  hobbies?: unknown;
  music?: unknown;
  food?: unknown;
  sports?: unknown;
};

export type ExperimentProfileRequirement = {
  key: 'photo' | 'quiz' | 'bio' | 'interests' | 'age';
  label: string;
  ready: boolean;
};

function listLength(value: unknown): number {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

// One source of truth for the profile gate used by the campaign, profile handoff,
// and entry endpoint. Optional video, gallery photos, prompts, and paid fields
// never block a free Dating Experiment entry.
export function experimentProfileReadiness(profile: ExperimentProfileInput) {
  const interests = listLength(profile.hobbies)
    + listLength(profile.music)
    + listLength(profile.food)
    + listLength(profile.sports);
  const requirements: ExperimentProfileRequirement[] = [
    { key: 'photo', label: 'a profile photo', ready: !!profile.photo_url },
    { key: 'quiz', label: 'the personality quiz', ready: !!profile.archetype && typeof profile.score_honesty === 'number' },
    { key: 'bio', label: 'a short bio', ready: !!profile.bio?.trim() },
    { key: 'interests', label: 'at least 3 interests', ready: interests >= 3 },
    { key: 'age', label: 'your age (21+)', ready: typeof profile.age === 'number' && profile.age >= 21 },
  ];
  const missing = requirements.filter((item) => !item.ready);
  return {
    complete: missing.length === 0,
    interests,
    requirements,
    missing,
  };
}
