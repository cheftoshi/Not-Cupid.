// Aggregate metadata only; private message content is neither read nor scored.
export function summarizeFriendPlanConversations(
  plans: Array<{ id: string; author_id: string; kind: string | null; is_test?: boolean }>,
  comments: Array<{ activity_id: string; user_id: string; created_at: string }>,
  realUserIds: Set<string>,
) {
  const eligible = new Map(plans.filter(p => !p.is_test && p.kind !== 'post' && realUserIds.has(p.author_id)).map(p => [p.id, p]));
  const threads = new Map<string, typeof comments>();
  for (const comment of comments) {
    if (!eligible.has(comment.activity_id) || !realUserIds.has(comment.user_id)) continue;
    const rows = threads.get(comment.activity_id) || [];
    rows.push(comment); threads.set(comment.activity_id, rows);
  }
  let participantThreads = 0, organizerReplies = 0;
  for (const [id, rows] of threads) {
    const author = eligible.get(id)!.author_id;
    const firstParticipant = rows.filter(r => r.user_id !== author).map(r => r.created_at).sort()[0];
    if (!firstParticipant) continue;
    participantThreads++;
    if (rows.some(r => r.user_id === author && r.created_at > firstParticipant)) organizerReplies++;
  }
  return { threads: threads.size, participantThreads, organizerReplies,
    awaitingOrganizer: participantThreads - organizerReplies };
}
