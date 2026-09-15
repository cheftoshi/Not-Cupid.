import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { hasMatchingEmbeddingConsent } from '@/lib/connection-embeddings';
import { embeddingShadowEnabled, evaluateEmbeddingShadow } from '@/lib/embedding-shadow';
import { shadowJobKey, shadowJobOutcome, type ShadowJobInput } from '@/lib/shadow-job-policy';

export async function enqueueEmbeddingShadow(input: ShadowJobInput) {
  if (!embeddingShadowEnabled() || !input.liveTopIds.length || !input.eligibleCandidateIds.length) return;
  // Await only a bounded durable insert, never vector search/evaluation. No
  // detached promise: once this succeeds a worker can recover after termination.
  const safe: ShadowJobInput = {
    userId: input.userId, intent: input.intent, liveAlgorithmVersion: input.liveAlgorithmVersion.slice(0,200),
    liveTopIds: [...new Set(input.liveTopIds)].slice(0,10),
    eligibleCandidateIds: [...new Set(input.eligibleCandidateIds)].slice(0,500),
    metro: input.metro?.slice(0,80), acquisitionSource: input.acquisitionSource?.slice(0,80),
  };
  const { error } = await supabaseAdmin.from('embedding_shadow_jobs').upsert({
    dedupe_key: shadowJobKey(safe), user_id: safe.userId, input: safe,
  }, { onConflict: 'dedupe_key', ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(1500));
  if (error) throw new Error('shadow_queue_write_failed');
}

export async function processEmbeddingShadowJobs() {
  const { data: jobs, error } = await supabaseAdmin.rpc('claim_embedding_shadow_jobs', { p_limit: 10 });
  if (error) throw new Error('shadow_queue_claim_failed');
  const counts = { claimed: jobs?.length || 0, done: 0, skipped: 0, pending: 0, failed: 0 };
  for (const job of jobs || []) {
    let result: { status: string; reason?: string } = { status: 'disabled', reason: 'disabled' };
    try {
      if (embeddingShadowEnabled()) {
        const { data: user, error: userError } = await supabaseAdmin.from('users')
          .select('id,deleted_at,is_blocked,ai_matching_consent_version,ai_matching_consent_at,ai_matching_consent_revoked_at')
          .eq('id',job.user_id).maybeSingle();
        if (userError) throw new Error('user_check_failed');
        if (!user || user.deleted_at || user.is_blocked || !hasMatchingEmbeddingConsent(user)) {
          result = { status: 'skipped', reason: 'consent_or_account_unavailable' };
        } else if (Date.now() - Date.parse(job.created_at) > 6 * 60 * 60 * 1000) {
          result = { status: 'skipped', reason: 'snapshot_expired' };
        } else {
          // RPC rechecks candidate consent, account status, and test/real realm.
          // This measures the observed eligible snapshot; it never serves a roster.
          const input = job.input as ShadowJobInput;
          result = await evaluateEmbeddingShadow({ ...input, userId: job.user_id, queueJobId: job.id });
        }
      }
    } catch { result = { status: 'failed', reason: 'evaluation_failed' }; }
    const status = shadowJobOutcome(result.status, job.attempts);
    const { error: finishError } = await supabaseAdmin.from('embedding_shadow_jobs').update({
      status, result_code: result.reason?.slice(0,80) || result.status,
      available_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      finished_at: status === 'pending' ? null : new Date().toISOString(), lease_until: null,
    }).eq('id',job.id).eq('lease_token',job.lease_token).eq('status','processing');
    if (finishError) throw new Error('shadow_queue_finish_failed');
    counts[status]++;
  }
  return counts;
}
