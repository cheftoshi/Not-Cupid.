export const EXPERIMENT_GENDERS = ['m', 'f', 'nb'] as const;
export const EXPERIMENT_ORIENTATION_OPTIONS = [
  { value: 'straight', label: 'straight' },
  { value: 'bisexual', label: 'bisexual' },
  { value: 'gay', label: 'gay' },
  { value: 'lesbian', label: 'lesbian' },
  { value: 'pansexual', label: 'pansexual' },
  { value: 'queer', label: 'queer' },
  { value: 'asexual', label: 'asexual / ace-spectrum' },
  { value: 'questioning', label: 'questioning / figuring it out' },
  { value: 'unlabeled', label: 'prefer not to label' },
] as const;

export type ExperimentGender = (typeof EXPERIMENT_GENDERS)[number];
export type ExperimentOrientation = (typeof EXPERIMENT_ORIENTATION_OPTIONS)[number]['value'];

export type ExperimentPreferenceSnapshot = {
  gender: ExperimentGender | null;
  orientation: ExperimentOrientation | null;
  seekingGenders: ExperimentGender[];
  ageMin: number | null;
  ageMax: number | null;
};

const isGender = (value: unknown): value is ExperimentGender =>
  EXPERIMENT_GENDERS.includes(value as ExperimentGender);

export function normalizeExperimentOrientation(value: unknown): ExperimentOrientation | null {
  return EXPERIMENT_ORIENTATION_OPTIONS.some((option) => option.value === value)
    ? value as ExperimentOrientation
    : null;
}

export function experimentOrientationLabel(value: unknown): string | null {
  const orientation = normalizeExperimentOrientation(value);
  if (!orientation || orientation === 'unlabeled') return null;
  return EXPERIMENT_ORIENTATION_OPTIONS.find((option) => option.value === orientation)?.label ?? null;
}

export function normalizeExperimentGenders(value: unknown): ExperimentGender[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isGender))];
}

export function experimentGendersFromLegacy(value: unknown): ExperimentGender[] {
  if (value === 'm') return ['m'];
  if (value === 'f') return ['f'];
  if (value === 'nb') return ['nb'];
  if (value === 'b' || value === 'both') return [...EXPERIMENT_GENDERS];
  return [];
}

function validAgeRange(ageMin: unknown, ageMax: unknown): ageMin is number {
  return Number.isInteger(ageMin)
    && Number.isInteger(ageMax)
    && Number(ageMin) >= 21
    && Number(ageMin) <= 99
    && Number(ageMax) >= Number(ageMin)
    && Number(ageMax) <= 99;
}

/**
 * Freeze the preferences accepted with an experiment entry. Older entries that
 * predate preference snapshots safely fall back to the current profile values.
 */
export function resolveExperimentPreferences(
  user: any,
  questionnaire?: any,
): ExperimentPreferenceSnapshot {
  const saved = questionnaire?.preferences ?? {};
  const savedSeeking = normalizeExperimentGenders(saved.seekingGenders);
  const fallbackSeeking = experimentGendersFromLegacy(user?.seeking);
  const savedAgeRangeValid = validAgeRange(saved.ageMin, saved.ageMax);
  return {
    gender: isGender(saved.gender) ? saved.gender : isGender(user?.gender) ? user.gender : null,
    orientation: normalizeExperimentOrientation(saved.orientation),
    seekingGenders: savedSeeking.length ? savedSeeking : fallbackSeeking,
    ageMin: savedAgeRangeValid ? saved.ageMin : Number.isInteger(user?.age_min) ? user.age_min : null,
    ageMax: savedAgeRangeValid ? saved.ageMax : Number.isInteger(user?.age_max) ? user.age_max : null,
  };
}

export function reciprocalExperimentGenderMatch(a: any, b: any): boolean {
  if (!isGender(a?.gender) || !isGender(b?.gender)) return false;
  const aSeeking = normalizeExperimentGenders(a?.seeking_genders);
  const bSeeking = normalizeExperimentGenders(b?.seeking_genders);
  return aSeeking.includes(b.gender) && bSeeking.includes(a.gender);
}

export function reciprocalExperimentAgeMatch(a: any, b: any): boolean {
  if (!Number.isInteger(a?.age) || !Number.isInteger(b?.age)) return false;
  if (!validAgeRange(a?.age_min, a?.age_max) || !validAgeRange(b?.age_min, b?.age_max)) return false;
  return b.age >= a.age_min
    && b.age <= a.age_max
    && a.age >= b.age_min
    && a.age <= b.age_max;
}
