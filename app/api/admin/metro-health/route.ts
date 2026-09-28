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

  const real: any[] = [];
  // Stable pagination avoids Supabase's default 1000-row response ceiling.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin.from('users')
      .select('id,gender,zip,status,pool_active,friend_opted_in_at,last_seen_at')
      .is('deleted_at', null).not('is_test', 'is', true).not('is_blocked', 'is', true)
      .order('id').range(offset, offset + 499);
    if (error) return NextResponse.json({ error: 'City metrics unavailable; retry.' }, { status: 503 });
    real.push(...(data || []));
    if (!data || data.length < 500) break;
  }

  type Bucket = { key: string; city: string; state: string; total: number; men: number; women: number; other: number; active: number; eligible: number; friends: number };
  const buckets: Record<string, Bucket> = {};
  for (const u of real) {
    const key = (metroOf(u.zip) as string) || '_other';
    if (!buckets[key]) {
      const mc = (METRO_CENTERS as any)[key];
      buckets[key] = { key, city: mc ? mc.city : 'Other / unknown', state: mc ? mc.state : '—', total: 0, men: 0, women: 0, other: 0, active: 0, eligible: 0, friends: 0 };
    }
    const b = buckets[key];
    b.total++;
    if (u.gender === 'm') b.men++;
    else if (u.gender === 'f') b.women++;
    else b.other++;
    if ((u.status === 'waiting' || u.status === 'matched') && u.pool_active !== false) b.eligible++;
    if (u.last_seen_at && Date.parse(u.last_seen_at) >= Date.now() - 7 * 86400000) b.active++;
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

  const outcomes = await supabaseAdmin.rpc('city_connection_health');
  if (outcomes.error) return NextResponse.json({ error: 'Connection metrics unavailable; retry.' }, { status: 503 });
  return NextResponse.json({ metros, totals, connections30d: outcomes.data, definitions: {
    active: 'Seen in the last seven days', eligible: 'Waiting or matched and pool active',
    total: 'Non-test, non-blocked, non-deleted accounts; not available inventory',
    connections30d: 'Last 30 days of actions, not a cohort conversion rate. Repeat participants acted on at least two different plans. Meetups are optional self-reports, not verified attendance.',
  } });
}
