// One authoritative boundary for the optional $0.99 Love compatibility
// deep-dive. Core profile content is free before a user chooses someone; the
// deep-dive is available only after a mutual connection and contains extra
// photos plus deeper lifestyle, values, and connection-style context.
export type LoveDeepDiveSummary = {
  available: boolean;
  items: string[];
  galleryCount: number;
};

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item.trim())
    : [];
}

function nonEmptyObject(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length > 0;
}

export function loveDeepDiveSummary(user: any): LoveDeepDiveSummary {
  const galleryCount = list(user?.gallery).length;
  const hasLifestyle = nonEmptyObject(user?.vibes);
  // relationship_style is intentionally part of the free profile baseline.
  // Only the deeper values answers belong to the optional deep-dive.
  const hasValues = nonEmptyObject(user?.values_profile);
  const hasConnectionStyle = !!user?.attach_style;

  const items = [
    galleryCount > 0 ? `${galleryCount} extra photo${galleryCount === 1 ? '' : 's'}` : null,
    hasLifestyle ? 'lifestyle rhythm' : null,
    hasValues ? 'values & relationship fit' : null,
    hasConnectionStyle ? 'communication style' : null,
  ].filter((item): item is string => !!item);

  return { available: items.length > 0, items, galleryCount };
}

export function freeLoveProfileView(user: any): any {
  return {
    ...user,
    // The human basics are always free. This removes only the optional
    // post-connection deep-dive data from the client payload.
    gallery: [],
    vibes: null,
    values_profile: null,
    attach_style: null,
    attach_anxiety: null,
    attach_avoidance: null,
  };
}
