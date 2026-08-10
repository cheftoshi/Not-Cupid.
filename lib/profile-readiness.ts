export type ProfileReadinessInput = {
  age?: number | null;
  gender?: string | null;
  seeking?: string | null;
  zip?: string | null;
  archetype?: string | null;
  score_honesty?: number | null;
  photo_url?: string | null;
  bio?: string | null;
  gallery?: unknown;
  music?: unknown;
  food?: unknown;
  hobbies?: unknown;
  sports?: unknown;
  prompts?: unknown;
  relationship_style?: string | null;
  attach_style?: string | null;
  intro_video_url?: string | null;
};

export type ProfileReadinessItem = {
  key: string;
  label: string;
  ready: boolean;
};

function listLength(value: unknown): number {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

export function profileReadiness(profile: ProfileReadinessInput) {
  const interests = listLength(profile.music) + listLength(profile.food) + listLength(profile.hobbies) + listLength(profile.sports);
  const prompts = Array.isArray(profile.prompts)
    ? profile.prompts.filter((prompt: any) => typeof prompt?.answer === 'string' && prompt.answer.trim()).length
    : 0;

  // These are the pieces that make a profile useful to another person. Video
  // and extra gallery photos remain bonuses, not fake blockers that label an
  // otherwise usable profile "incomplete."
  const items: ProfileReadinessItem[] = [
    { key: 'photo', label: 'main photo', ready: !!profile.photo_url },
    { key: 'bio', label: 'short bio', ready: !!profile.bio?.trim() },
    { key: 'interests', label: '3 interests', ready: interests >= 3 },
    { key: 'prompt', label: 'conversation prompt', ready: prompts > 0 },
    { key: 'relationship', label: 'relationship style', ready: !!profile.relationship_style },
    { key: 'love_answers', label: 'Love preferences', ready: !!profile.attach_style },
  ];
  const coreReady = !!profile.archetype
    && typeof profile.score_honesty === 'number'
    && !!profile.age
    && !!profile.gender
    && !!profile.seeking
    && !!profile.zip;
  const readyCount = items.filter((item) => item.ready).length;
  const missing = items.filter((item) => !item.ready);

  return {
    coreReady,
    items,
    missing,
    readyCount,
    percent: Math.round((readyCount / items.length) * 100),
    complete: missing.length === 0,
    bonuses: [
      { key: 'gallery', label: '2 extra photos', ready: listLength(profile.gallery) >= 2 },
      { key: 'video', label: 'optional video hello', ready: !!profile.intro_video_url },
    ] satisfies ProfileReadinessItem[],
  };
}
