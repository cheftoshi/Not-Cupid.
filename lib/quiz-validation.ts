export function clampQuizScore(value: unknown): number {
  return Math.max(0, Math.min(8, Number(value) || 0));
}

export function validQuizObjects(body: Record<string, unknown>): boolean {
  return ['vibes', 'values_profile'].every((key) => {
    const value = body[key];
    if (value == null) return true;
    if (typeof value !== 'object' || Array.isArray(value)) return false;
    try { return JSON.stringify(value).length <= 5000; } catch { return false; }
  });
}
