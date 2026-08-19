import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';

export async function compatibilityReadRecord(userId: string, candidateId: string) {
  const { data, error } = await supabaseAdmin
    .from('love_compatibility_reads')
    .select('id, connection_unlock_id, report, report_source, report_version, generated_at')
    .eq('user_id', userId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function ensureCompatibilityReadEntitlement(input: {
  userId: string;
  candidateId: string;
  connectionUnlockId: string;
  rosterCycleAt?: string | null;
  stripeSessionId?: string | null;
  stripePaymentId?: string | null;
}) {
  const { data, error } = await supabaseAdmin.from('love_compatibility_reads').upsert({
    user_id: input.userId,
    candidate_id: input.candidateId,
    connection_unlock_id: input.connectionUnlockId,
    roster_cycle_at: input.rosterCycleAt ? new Date(input.rosterCycleAt).toISOString() : null,
    stripe_session_id: input.stripeSessionId ?? null,
    stripe_payment_id: input.stripePaymentId ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,candidate_id' }).select('id, connection_unlock_id').single();
  if (error || !data) throw new Error(error?.message || 'Could not grant the compatibility read.');
  return data;
}
