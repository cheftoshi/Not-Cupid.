// Gender-balance intake gating — DB-backed helpers (kept out of lib/pools.ts,
// which stays pure). Computes each metro's active-pool gender split and
// decides whether a new over-represented signup should be held, plus releases
// held users as the scarce side grows (or after the anti-churn cap).

import { supabaseAdmin } from '@/lib/supabase';
import { metroOf } from '@/lib/quiz-data';
import { maxOverrep, BALANCE_MIN_POOL, MAX_BALANCE_HOLD_DAYS } from '@/lib/pools';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';

type Counts = { m: number; f: number; other: number };

// Use the same real-account eligibility on reads AND release writes. In
// particular, an old hold must never reactivate a deleted/blocked/test account.
function eligible(query: any, now: string) {
  return query.is('deleted_at', null)
    .or('is_test.is.null,is_test.eq.false')
    .or('is_blocked.is.null,is_blocked.eq.false')
    .is('matching_disabled_at', null)
    .or(`matching_cooldown_until.is.null,matching_cooldown_until.lte.${now}`);
}

// Active matchable pool tallied by metro + gender. "Active" = pool_active and
// not in a penalty state. Held users (pool_active=false) are excluded — they
// aren't competing yet.
export async function metroGenderCounts(): Promise<Record<string, Counts>> {
  const now = new Date().toISOString();
  const data = await fetchAllSupabaseRows<any>((from, to) => eligible(supabaseAdmin
    .from('users')
    .select('id, gender, zip')
    .eq('pool_active', true), now)
    .order('id', { ascending: true }).range(from, to), 500);

  const out: Record<string, Counts> = {};
  for (const u of data ?? []) {
    const metro = metroOf(u.zip) ?? 'unknown';
    if (!out[metro]) out[metro] = { m: 0, f: 0, other: 0 };
    if (u.gender === 'm') out[metro].m++;
    else if (u.gender === 'f') out[metro].f++;
    else out[metro].other++;
  }
  return out;
}

// Should a NEW binary signup of `gender` in this metro be held for balance?
// Only gates real straight skew in a metro that already has volume.
export function shouldHoldForBalance(counts: Counts | undefined, gender: string | null | undefined): boolean {
  if (!counts) return false;
  if (gender !== 'm' && gender !== 'f') return false;
  const total = counts.m + counts.f;
  if (total < BALANCE_MIN_POOL) return false; // seed a new metro before gating
  const same = gender === 'm' ? counts.m : counts.f;
  const scarce = gender === 'm' ? counts.f : counts.m;
  return same >= maxOverrep(scarce); // adding them would breach the ceiling
}

// Release held users: oldest-held first, as long as their metro has room under
// the ceiling — plus anyone past the max hold (anti-churn). Returns released ids.
export async function releaseBalanceHolds(): Promise<string[]> {
  const now = Date.now();
  const held = await fetchAllSupabaseRows<any>((from, to) => eligible(supabaseAdmin
    .from('users')
    .select('id, gender, zip, balance_hold_at')
    .not('balance_hold_at', 'is', null)
    .eq('pool_active', false), new Date(now).toISOString())
    .order('balance_hold_at', { ascending: true })
    .order('id', { ascending: true }).range(from, to), 500);
  if (!held?.length) return [];

  const counts = await metroGenderCounts();
  const maxHoldMs = MAX_BALANCE_HOLD_DAYS * 86_400_000;
  const toRelease: string[] = [];

  for (const u of held) {
    const metro = metroOf(u.zip) ?? 'unknown';
    const c = counts[metro] ?? { m: 0, f: 0, other: 0 };
    const ageMs = u.balance_hold_at ? now - new Date(u.balance_hold_at).getTime() : Infinity;
    let release = ageMs > maxHoldMs; // anti-churn: never hold longer than the cap

    if (!release && (u.gender === 'm' || u.gender === 'f')) {
      const same = u.gender === 'm' ? c.m : c.f;
      const scarce = u.gender === 'm' ? c.f : c.m;
      if (same < maxOverrep(scarce)) release = true; // room opened up
    }

    if (release) {
      toRelease.push(u.id);
      // reflect immediately so we don't over-release the same metro this run
      if (u.gender === 'm') c.m++;
      else if (u.gender === 'f') c.f++;
      else c.other++;
      counts[metro] = c;
    }
  }

  const released: string[] = [];
  for (let i = 0; i < toRelease.length; i += 100) {
    const { data, error } = await eligible(supabaseAdmin
      .from('users')
      .update({ pool_active: true, balance_hold_at: null, status: 'waiting' })
      .in('id', toRelease.slice(i, i + 100))
      .eq('pool_active', false)
      .not('balance_hold_at', 'is', null), new Date().toISOString())
      .select('id');
    if (error) throw new Error('Could not release eligible balance holds');
    released.push(...(data ?? []).map((row: { id: string }) => row.id));
  }
  return released;
}
