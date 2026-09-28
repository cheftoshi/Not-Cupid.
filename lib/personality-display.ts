// No score-version marker exists on older profiles. Bound presentation only;
// do not guess a historic scale or rewrite their scores/archetype.
export function personalityPercent(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.round(Math.max(0, Math.min(8, score)) / 8 * 100);
}
