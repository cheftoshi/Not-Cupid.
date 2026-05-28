import { supabaseAdmin } from '@/lib/supabase';

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; reason: 'throttled' | 'blocked' };

/**
 * Sliding-window-ish rate limiter backed by the `rate_limits` table.
 * If the row's window has expired we reset; otherwise we increment and check.
 * Fails open (allows the request) if the rate_limits table is missing or unreachable —
 * this avoids locking everyone out if the migration hasn't run yet.
 */
export async function rateLimit(args: {
  key: string;
  windowSec: number;
  maxAttempts: number;
  blockSec?: number;
}): Promise<RateLimitResult> {
  const { key, windowSec, maxAttempts, blockSec } = args;
  const now = new Date();
  const nowMs = now.getTime();

  try {
    const { data: existing, error: selErr } = await supabaseAdmin
      .from('rate_limits')
      .select('count, window_start, blocked_until')
      .eq('key', key)
      .maybeSingle();

    if (selErr) {
      // Likely the table doesn't exist yet — fail open but log so the operator notices.
      console.warn('[rate-limit] select failed, failing open:', selErr.message);
      return { ok: true };
    }

    if (existing?.blocked_until) {
      const blockedUntilMs = new Date(existing.blocked_until).getTime();
      if (blockedUntilMs > nowMs) {
        return {
          ok: false,
          retryAfterSec: Math.ceil((blockedUntilMs - nowMs) / 1000),
          reason: 'blocked',
        };
      }
    }

    const windowStartMs = existing ? new Date(existing.window_start).getTime() : 0;
    const windowExpired = nowMs - windowStartMs > windowSec * 1000;

    if (!existing || windowExpired) {
      await supabaseAdmin.from('rate_limits').upsert(
        { key, count: 1, window_start: now.toISOString(), blocked_until: null },
        { onConflict: 'key' }
      );
      return { ok: true };
    }

    const newCount = (existing.count ?? 0) + 1;

    if (newCount > maxAttempts) {
      const blockedUntil = blockSec
        ? new Date(nowMs + blockSec * 1000).toISOString()
        : null;
      await supabaseAdmin
        .from('rate_limits')
        .update({ count: newCount, blocked_until: blockedUntil })
        .eq('key', key);
      return {
        ok: false,
        retryAfterSec: blockSec ?? Math.ceil((windowStartMs + windowSec * 1000 - nowMs) / 1000),
        reason: 'throttled',
      };
    }

    await supabaseAdmin
      .from('rate_limits')
      .update({ count: newCount })
      .eq('key', key);

    return { ok: true };
  } catch (err) {
    console.warn('[rate-limit] unexpected error, failing open:', err);
    return { ok: true };
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
