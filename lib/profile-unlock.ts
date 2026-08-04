// Shared definition of the $0.99 Love compatibility-profile value. Keep the
// dashboard, match room, and checkout eligibility aligned so the app never
// advertises an empty purchase or gives paid fields away on another surface.

export type ProfileUnlockSummary = {
  available: boolean;
  items: string[];
  galleryCount: number;
  interestCount: number;
};

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()) : [];
}

function nonEmptyObject(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length > 0;
}

export function profileUnlockSummary(user: any): ProfileUnlockSummary {
  const hasBio = !!String(user?.bio || '').trim();
  const galleryCount = list(user?.gallery).length;
  const interestCount = new Set([
    ...list(user?.music),
    ...list(user?.food),
    ...list(user?.hobbies),
    ...list(user?.sports),
  ].map((item) => item.toLowerCase())).size;
  const hasPrompts = Array.isArray(user?.prompts)
    ? user.prompts.length > 0
    : nonEmptyObject(user?.prompts);
  const hasLifestyle = nonEmptyObject(user?.vibes);
  // relationship_style is intentionally part of the free profile baseline.
  // Only count the deeper values answers as paid value.
  const hasValues = nonEmptyObject(user?.values_profile);
  const hasConnectionStyle = !!user?.attach_style;

  const items = [
    hasBio ? 'their bio' : null,
    galleryCount > 0 ? `${galleryCount} extra photo${galleryCount === 1 ? '' : 's'}` : null,
    interestCount > 0 ? `${interestCount} interest${interestCount === 1 ? '' : 's'}` : null,
    hasPrompts ? 'profile prompts' : null,
    hasLifestyle ? 'lifestyle rhythm' : null,
    hasValues ? 'values & relationship fit' : null,
    hasConnectionStyle ? 'communication style' : null,
  ].filter((item): item is string => !!item);

  return { available: items.length > 0, items, galleryCount, interestCount };
}

export function lockedProfileView(user: any): any {
  return {
    ...user,
    bio: null,
    gallery: [],
    music: [],
    food: [],
    hobbies: [],
    sports: [],
    prompts: null,
    vibes: null,
    values_profile: null,
    attach_style: null,
    attach_anxiety: null,
    attach_avoidance: null,
  };
}
