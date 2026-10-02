import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { cancelStripeSubscription } from '@/lib/subscription-management';
import { removeAccountMedia } from '@/lib/account-media-cleanup';

/** Claims are leased; a killed worker is retried, and stale workers cannot finish another lease. */
export async function processAccountCleanup(limit = 2) {
  const { data: jobs, error } = await supabaseAdmin.rpc('claim_account_cleanup', { p_limit: limit });
  if (error) throw Error('cleanup_claim_failed');
  const result = { claimed: jobs?.length || 0, completed: 0, retry: 0, dead: 0 };
  await Promise.all((jobs || []).map(async (job: any) => {
    let billingDone = job.billing_done === true;
    let mediaDone = job.media_done === true;
    let errorCode: string | null = null;
    const { data: user, error: lookupError } = await supabaseAdmin.from('users')
      .select('deleted_at,friend_sub_id').eq('id', job.user_id).maybeSingle();
    if (lookupError || !user) errorCode = 'cleanup_user_lookup_failed';
    else if (!user.deleted_at) errorCode = 'cleanup_account_not_deleted';
    else {
      if (!billingDone) billingDone = !user.friend_sub_id || await cancelStripeSubscription(user.friend_sub_id);
      if (!mediaDone) {
        try { await removeAccountMedia(job.user_id); mediaDone = true; }
        catch { errorCode = 'cleanup_media_pending'; }
      }
      if (!billingDone) errorCode = 'cleanup_billing_pending';
    }
    const status = !errorCode && billingDone && mediaDone ? 'completed'
      : job.attempts >= 12 || errorCode === 'cleanup_account_not_deleted' ? 'dead' : 'retry';
    const { data, error: finishError } = await supabaseAdmin.from('account_cleanup_jobs').update({
      status, billing_done: billingDone, media_done: mediaDone, last_error_code: errorCode,
      available_at: new Date(Date.now() + Math.min(86400, 60 * 2 ** Math.min(job.attempts, 11)) * 1000).toISOString(),
      lease_token: null, lease_until: null, updated_at: new Date().toISOString(),
    }).eq('user_id', job.user_id).eq('lease_token', job.lease_token).eq('status', 'processing').select('user_id');
    if (finishError) throw Error('cleanup_progress_write_failed');
    if (data?.length) result[status]++;
  }));
  return result;
}
