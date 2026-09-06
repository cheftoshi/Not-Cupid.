import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY before running this report.');
  process.exit(1);
}

const requestedDays = Number(process.argv[2] || 30);
const days = Number.isFinite(requestedDays) ? Math.max(1, Math.min(365, Math.round(requestedDays))) : 30;
const since = new Date(Date.now() - days * 86_400_000).toISOString();
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const [{ data: matching, error: matchingError }, { data: outbox, error: outboxError }] = await Promise.all([
  supabase.rpc('matching_rollout_summary', { p_since: since }),
  supabase.rpc('notification_outbox_health'),
]);
if (matchingError || outboxError) {
  console.error(JSON.stringify({ matchingError: matchingError?.message, outboxError: outboxError?.message }, null, 2));
  process.exit(1);
}

const rows = (matching || []).map((row) => {
  const exposures = Number(row.exposures || 0);
  const picks = Number(row.picks || 0);
  const mutual = Number(row.mutual_matches || 0);
  return {
    algorithm: row.algorithm_version,
    exposures,
    users: Number(row.exposed_users || 0),
    picks,
    pick_rate_pct: exposures ? Number((100 * picks / exposures).toFixed(1)) : 0,
    mutual,
    mutual_per_pick_pct: picks ? Number((100 * mutual / picks).toFixed(1)) : 0,
    two_sided_chats: Number(row.two_sided_conversations || 0),
  };
});

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), windowDays: days, matching: rows, notificationOutbox: outbox?.[0] || {} }, null, 2));
