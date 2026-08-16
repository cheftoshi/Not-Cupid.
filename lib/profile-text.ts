export type ProfileTextResult =
  | { ok: true; value: string | null }
  | { ok: false; reason: 'required' | 'type' | 'length' };

/**
 * Normalizes a user-editable profile text field without rejecting legacy nulls.
 * Optional blank values are stored as null; required values must be non-empty.
 */
export function normalizeProfileText(
  value: unknown,
  maxLength: number,
  required = false,
): ProfileTextResult {
  if (value == null) {
    return required
      ? { ok: false, reason: 'required' }
      : { ok: true, value: null };
  }

  if (typeof value !== 'string') return { ok: false, reason: 'type' };

  const normalized = value.trim();
  if (required && normalized.length === 0) return { ok: false, reason: 'required' };
  if (normalized.length > maxLength) return { ok: false, reason: 'length' };

  return { ok: true, value: normalized || null };
}
