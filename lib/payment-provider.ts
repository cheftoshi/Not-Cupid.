import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';
import { classifyStripeFailure, type StripeFailureCode } from '@/lib/stripe-failure';

const PROVIDER = 'stripe' as const;
const DEFAULT_RETRY_SECONDS = 15 * 60;

type CheckoutResult =
  | { ok: true; url: string; sessionId: string | null }
  | { ok: false; code: StripeFailureCode | 'circuit_open'; providerStatus: number | null; retryAfterSec: number };

function retrySecondsFor(code: StripeFailureCode): number {
  if (code === 'provider_rate_limited') return 2 * 60;
  if (code === 'provider_unavailable') return 5 * 60;
  return DEFAULT_RETRY_SECONDS;
}

async function retryAfterFromState(): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('payment_provider_state')
      .select('unavailable_until,last_checked_at,status')
      .eq('provider', PROVIDER)
      .maybeSingle();
    const until = data?.unavailable_until ? new Date(data.unavailable_until).getTime() : 0;
    if (until > Date.now()) return Math.max(1, Math.ceil((until - Date.now()) / 1000));
    if (data?.status === 'probing') return 30;
  } catch { /* migration may be rolling out; use a safe fallback */ }
  return 60;
}

async function claimProviderRequest(): Promise<{ allowed: boolean; retryAfterSec: number; generation: number }> {
  try {
    const { data, error } = await supabaseAdmin.rpc('claim_payment_provider_request', { p_provider: PROVIDER });
    // Availability tracking must not strand a valid payment during a rolling
    // migration. If the state mechanism itself is unavailable, attempt Stripe.
    if (error) return { allowed: true, retryAfterSec: 0, generation: 0 };
    if (typeof data === 'number' && data >= 0) return { allowed: true, retryAfterSec: 0, generation: data };
    return { allowed: false, retryAfterSec: await retryAfterFromState(), generation: 0 };
  } catch {
    return { allowed: true, retryAfterSec: 0, generation: 0 };
  }
}

async function markHealthy(): Promise<void> {
  const now = new Date().toISOString();
  try {
    await supabaseAdmin.from('payment_provider_state').upsert({
      provider: PROVIDER,
      status: 'healthy',
      failure_code: null,
      unavailable_until: null,
      last_checked_at: now,
      last_success_at: now,
      updated_at: now,
    }, { onConflict: 'provider' });
  } catch { /* checkout success must not depend on observability */ }
}

async function markUnavailable(code: StripeFailureCode, retryAfterSec: number): Promise<void> {
  const now = new Date();
  try {
    await supabaseAdmin.from('payment_provider_state').upsert({
      provider: PROVIDER,
      status: 'unavailable',
      failure_code: code,
      unavailable_until: new Date(now.getTime() + retryAfterSec * 1000).toISOString(),
      last_checked_at: now.toISOString(),
      last_failure_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'provider' });
  } catch { /* provider response remains authoritative */ }
}

export async function createStripeCheckoutSession(input: {
  params: URLSearchParams;
  idempotencyKey?: string;
}): Promise<CheckoutResult> {
  const gate = await claimProviderRequest();
  if (!gate.allowed) {
    return { ok: false, code: 'circuit_open', providerStatus: null, retryAfterSec: gate.retryAfterSec };
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    await markUnavailable('server_missing_key', DEFAULT_RETRY_SECONDS);
    return { ok: false, code: 'server_missing_key', providerStatus: null, retryAfterSec: DEFAULT_RETRY_SECONDS };
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(input.idempotencyKey ? { 'Idempotency-Key': `${input.idempotencyKey}-g${gate.generation}` } : {}),
      },
      body: input.params.toString(),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload.url !== 'string') {
      const code = classifyStripeFailure(response.status, payload);
      const retryAfterSec = retrySecondsFor(code);
      await markUnavailable(code, retryAfterSec);
      console.error('Stripe checkout unavailable:', { code, providerStatus: response.status });
      return { ok: false, code, providerStatus: response.status, retryAfterSec };
    }
    await markHealthy();
    return { ok: true, url: payload.url, sessionId: typeof payload.id === 'string' ? payload.id : null };
  } catch {
    const code: StripeFailureCode = 'provider_unavailable';
    const retryAfterSec = retrySecondsFor(code);
    await markUnavailable(code, retryAfterSec);
    console.error('Stripe checkout unavailable:', { code, providerStatus: 0 });
    return { ok: false, code, providerStatus: 0, retryAfterSec };
  }
}

export const PAYMENT_TEMPORARILY_UNAVAILABLE_MESSAGE =
  'Payments are temporarily unavailable. Nothing was charged. Please try again later.';
