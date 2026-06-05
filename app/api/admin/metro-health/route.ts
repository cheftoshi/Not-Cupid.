import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

// Per-metro health across New England: who's where, the gender split / ratio
// (the supply read that actually drives growth), pool size, and friend opt-ins.
// Real users only (test accounts excluded).
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('gender, zip, status, pool_active, friend_opted_in_at, is_test')
    .is('deleted_at', null);

  const real = (users ?? []).filter((u: any) => !u.is_test);

  type Bucket = { key: string; city: string; state: string; total: number; men: number; women: number; other: number; active: number; friends: number };
  const buckets: Record<string, Bucket> = {};
  for (const u of real) {
    const key = (metroOf(u.zip) as string) || '_other';
    if (!buckets[key]) {
      const mc = (METRO_CENTERS as any)[key];
      buckets[key] = { key, city: mc ? mc.city : 'Other / unknown', state: mc ? mc.state : '—', total: 0, men: 0, women: 0, other: 0, active: 0, friends: 0 };
    }
    const b = buckets[key];
    b.total++;
    if (u.gender === 'm') b.men++;
    else if (u.gender === 'f') b.women++;
    else b.other++;
    if ((u.status === 'waiting' || u.status === 'matched') && u.pool_active !== false) b.active++;
    if (u.friend_opted_in_at) b.friends++;
  }

  const metros = Object.values(buckets)
    .map((b) => ({
      ...b,
      womenPct: b.total ? Math.round((b.women / b.total) * 100) : 0,
      // men per woman — higher = more male-skewed; null = men but zero women (worst).
      ratio: b.women > 0 ? +(b.men / b.women).toFixed(1) : (b.men > 0 ? null : 0),
    }))
    .sort((a, b) => b.total - a.total);

  const totals = real.reduce(
    (a: any, u: any) => { a.total++; if (u.gender === 'm') a.men++; else if (u.gender === 'f') a.women++; return a; },
    { total: 0, men: 0, women: 0 }
  );

  return NextResponse.json({ metros, totals });
}
