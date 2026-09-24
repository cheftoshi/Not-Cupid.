type Job = { status: string; result_code: string | null; created_at: string; finished_at: string | null; available_at: string; lease_until: string | null };

export function summarizeShadowHealth({ enabled, readyUsers, jobs, available = true, now = Date.now() }: {
  enabled: boolean; readyUsers: number | null; jobs: Job[]; available?: boolean; now?: number;
}) {
  const statuses: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  let overdue = 0;
  for (const job of jobs) {
    statuses[job.status] = (statuses[job.status] || 0) + 1;
    if (job.result_code) reasons[job.result_code] = (reasons[job.result_code] || 0) + 1;
    const due = job.status === 'processing' ? job.lease_until : job.status === 'pending' ? job.available_at : null;
    if (due && Date.parse(due) < now - 15 * 60_000) overdue++;
  }
  const lastFinishedAt = jobs.flatMap(job => job.finished_at ? [job.finished_at] : []).sort().at(-1) || null;
  const diagnosis = !available || readyUsers === null ? 'diagnostics_unavailable'
    : !enabled ? 'runtime_disabled'
      : overdue ? 'queue_overdue'
        : statuses.failed ? 'evaluation_failures'
          : readyUsers < 2 ? 'insufficient_embedding_coverage'
            : jobs.length === 0 ? 'no_recent_jobs'
              : reasons.insufficient_shadow_coverage ? 'insufficient_reciprocal_coverage'
                : 'jobs_observed';
  return { diagnosis, statuses, reasons, overdue, lastFinishedAt,
    // Terminal jobs are pruned after one day. An empty queue is not evidence
    // that cron ran; completed jobs prove past work, not future health.
    schedulerVerified: false,
    note: 'Queue records retain about 24 hours. No jobs alone cannot prove scheduler health. Ready embeddings do not guarantee a mutually eligible pair.' };
}
