import { supabaseAdmin } from '@/lib/supabase';

// Records a compatibility deep-dive without clobbering a historical purchase.
// `profile` is the legacy database tier name for the current $0.99 deep-dive;
// `hexaco` remains only for old entitlements and is no longer sold separately.
export async function recordUnlock(opts: {
  userId: string;
  matchId: string;
  unlockedUserId: string;
  tier: 'hexaco' | 'profile';
  paymentId?: string | null;
}) {
  const { userId, matchId, unlockedUserId, tier, paymentId } = opts;

  const { data: existing } = await supabaseAdmin
    .from('match_unlocks')
    .select('hexaco_unlocked, profile_unlocked')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .maybeSingle();

  const hexaco_unlocked = !!existing?.hexaco_unlocked || tier === 'hexaco' || tier === 'profile';
  const profile_unlocked = !!existing?.profile_unlocked || tier === 'profile';

  const { error } = await supabaseAdmin.from('match_unlocks').upsert(
    {
      user_id: userId,
      match_id: matchId,
      unlocked_user_id: unlockedUserId,
      hexaco_unlocked,
      profile_unlocked,
      amount_cents: 99,
      stripe_payment_id: paymentId ?? null,
    },
    { onConflict: 'user_id,match_id' }
  );
  return error;
}
