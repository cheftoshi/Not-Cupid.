import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; reason: 'throttled' | 'blocked' | 'unavailable' };

/**
 * Atomic, database-backed limiter. The RPC serializes requests for the same
 * key in one transaction, preventing parallel requests from racing a
 * read/increment/write sequence. Keys are hashed before storage so email/IP
 * identifiers are not retained in plaintext.
 *
 * This deliberately fails closed. If abuse protection is unavailable, a
 * caller can retry shortly instead of reaching an unprotected sensitive route.
 */
export async function rateLimit(args: {
  key: string;
  windowSec: number;
  maxAttempts: number;
  blockSec?: number;
}): Promise<RateLimitResult> {
  const dbKey = `v2:${createHash('sha256').update(args.key).digest('hex')}`;

  try {
    const { data, error } = await supabaseAdmin.rpc('consume_rate_limit', {
      p_key: dbKey,
      p_window_sec: args.windowSec,
      p_max_attempts: args.maxAttempts,
      p_block_sec: args.blockSec ?? 0,
    });

    if (error) {
      console.error('[rate-limit] atomic RPC failed:', error.message);
      return { ok: false, retryAfterSec: 60, reason: 'unavailable' };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== 'boolean') {
      console.error('[rate-limit] atomic RPC returned an invalid response');
      return { ok: false, retryAfterSec: 60, reason: 'unavailable' };
    }

    if (row.allowed) return { ok: true };
    return {
      ok: false,
      retryAfterSec: Math.max(1, Number(row.retry_after_sec) || 60),
      reason: row.reason === 'blocked' ? 'blocked' : 'throttled',
    };
  } catch (err) {
    console.error('[rate-limit] unexpected failure:', err);
    return { ok: false, retryAfterSec: 60, reason: 'unavailable' };
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim().slice(0, 64);
  return (req.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}
