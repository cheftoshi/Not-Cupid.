export type ReciprocalOutcomeStats = {
  invitations: number;
  acceptedInvitations: number;
  mutualMatches: number;
  repliedMatches: number;
};

// Small, evidence-shrunk reranking signal. New users stay neutral; behavior
// only begins to matter after real opportunities, and the adjustment is capped
// tightly so compatibility, activity, capacity, and fairness still lead.
export function reciprocalMomentumAdjustment(stats: ReciprocalOutcomeStats): number {
  const invitations = Math.max(0, stats.invitations);
  const mutual = Math.max(0, stats.mutualMatches);
  if (invitations < 2 && mutual < 1) return 0;

  const acceptRate = (Math.max(0, stats.acceptedInvitations) + 2) / (invitations + 4);
  const replyRate = (Math.max(0, stats.repliedMatches) + 1.5) / (mutual + 3);
  const evidence = Math.min(1, (invitations + mutual) / 8);
  const raw = ((acceptRate - 0.5) * 4 + (replyRate - 0.5) * 3) * evidence;
  return Math.round(Math.max(-1.5, Math.min(2, raw)) * 10) / 10;
}
