import { supabaseAdmin } from '@/lib/supabase';
import { isPro } from '@/lib/pro';
import { LOVE_CONNECTION_PRICE_CENTS, LOVE_INCLUDED_PICKS } from '@/lib/matching-policy';
import { sendPushToUser } from '@/lib/push';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LoveConnectionCredit = {
  id: string;
  intendedCandidateId: string | null;
};

export async function ensureLovePickCycle(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('ensure_love_pick_cycle', { p_user_id: userId });
  if (error || typeof data !== 'string') throw new Error(error?.message || 'Could not open the Love roster cycle.');
  return data;
}

export async function lovePickAccessFor(user: any) {
  const cycleAt = await ensureLovePickCycle(user.id);
  const [{ count, error: ledgerError }, { data: credits, error: creditError }] = await Promise.all([
    supabaseAdmin
      .from('love_pick_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('roster_cycle_at', cycleAt)
      .eq('access_type', 'included')
      .neq('status', 'returned'),
    supabaseAdmin
      .from('love_connection_unlocks')
      .select('id, intended_candidate_id')
      .eq('user_id', user.id)
      .in('status', ['purchased', 'credit'])
      .order('created_at', { ascending: true })
      .limit(10),
  ]);
  if (ledgerError) throw new Error(ledgerError.message);
  if (creditError) throw new Error(creditError.message);
  const includedUsed = Math.max(0, count ?? 0);
  return {
    cycleAt,
    includedUsed,
    includedRemaining: Math.max(0, LOVE_INCLUDED_PICKS - includedUsed),
    pro: isPro(user),
    credits: (credits ?? []).map((credit: any) => ({
      id: credit.id,
      intendedCandidateId: credit.intended_candidate_id ?? null,
    })) as LoveConnectionCredit[],
  };
}

export function creditForCandidate(
  credits: LoveConnectionCredit[],
  candidateId: string,
): LoveConnectionCredit | null {
  return credits.find((credit) => credit.intendedCandidateId === candidateId)
    ?? credits.find((credit) => credit.intendedCandidateId === null)
    ?? null;
}

export async function recordLoveConnectionPurchase(session: any) {
  const userId = session?.metadata?.user_id;
  const candidateId = session?.metadata?.candidate_id;
  const cycleAt = session?.metadata?.roster_cycle_at;
  const paymentId = session?.payment_intent;
  // Checkout can be `complete` before an asynchronous payment method settles.
  // A connection credit is money-backed only after Stripe marks it paid.
  const paid = session?.payment_status === 'paid';
  if (
    !paid || session?.metadata?.type !== 'love_connection' ||
    !UUID_RE.test(String(userId || '')) || !UUID_RE.test(String(candidateId || '')) ||
    typeof session?.id !== 'string' || typeof paymentId !== 'string' ||
    session?.currency !== 'usd' || Number(session?.amount_total) !== LOVE_CONNECTION_PRICE_CENTS ||
    !Number.isFinite(Date.parse(String(cycleAt || '')))
  ) {
    throw new Error('Invalid Love connection checkout session.');
  }
  const { data: existing } = await supabaseAdmin
    .from('love_connection_unlocks')
    .select('id, user_id, intended_candidate_id, status')
    .eq('stripe_session_id', session.id)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabaseAdmin
    .from('love_connection_unlocks')
    .insert({
      user_id: userId,
      intended_candidate_id: candidateId,
      roster_cycle_at: new Date(cycleAt).toISOString(),
      stripe_session_id: session.id,
      stripe_payment_id: paymentId,
      amount_cents: LOVE_CONNECTION_PRICE_CENTS,
      status: 'purchased',
    })
    .select('id, user_id, intended_candidate_id, status')
    .single();
  if (error || !data) {
    // The success redirect and signed webhook can race. A duplicate is an
    // idempotent success; importantly, never reset an already-consumed credit.
    if (error?.code === '23505') {
      const { data: raced } = await supabaseAdmin
        .from('love_connection_unlocks')
        .select('id, user_id, intended_candidate_id, status')
        .eq('stripe_session_id', session.id)
        .single();
      if (raced) return raced;
    }
    throw new Error(error?.message || 'Could not record the extra connection.');
  }
  return data;
}

export type ReturnedLoveEntitlement = 'included' | 'paid' | null;

export async function returnLovePickEntitlement(
  matchId: string,
  declinerId: string | null,
): Promise<ReturnedLoveEntitlement> {
  const { data, error } = await supabaseAdmin.rpc('return_love_pick_entitlement', {
    p_match_id: matchId,
    p_decliner_id: declinerId,
  });
  if (error) {
    console.error('returnLovePickEntitlement failed:', error.message);
    return null;
  }
  const returned = data === 'included' || data === 'paid' ? data : null;
  if (returned === 'paid') {
    const { data: ledger } = await supabaseAdmin
      .from('love_pick_ledger')
      .select('user_id')
      .eq('match_id', matchId)
      .eq('access_type', 'paid')
      .eq('status', 'returned')
      .maybeSingle();
    if (ledger?.user_id) {
      await sendPushToUser(ledger.user_id, {
        title: 'Your Love credit is back',
        body: 'That connection did not become mutual. Your next extra Love pick is covered in the app.',
        url: '/dashboard#roster',
        tag: `love-credit-${matchId}`,
      });
    }
  }
  return returned;
}
