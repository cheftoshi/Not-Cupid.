import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { metroOf, METRO_CENTERS, isEligibleZip } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

// Public "who's waiting" teaser for the signup form — the moment the ZIP goes
// in, show the pool is real ("214 people in the Boston experiment · 41 joined
// this month"). No PII: counts + city label only.
export async function GET(req: NextRequest) {
  const zip = String(req.nextUrl.searchParams.get('zip') || '').trim();
  if (!/^\d{5}$/.test(zip) || !isEligibleZip(zip)) return NextResponse.json({ ok: false });

  const metro = metroOf(zip);
  const city = metro && METRO_CENTERS[metro] ? METRO_CENTERS[metro].city : null;
  if (!metro || !city) return NextResponse.json({ ok: false });

  // Metro membership is computed in JS (metroOf) — pull just zips, bounded.
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [{ data: pool }, { data: fresh }] = await Promise.all([
    supabaseAdmin.from('users').select('zip').is('deleted_at', null).not('is_test', 'is', true).limit(4000),
    supabaseAdmin.from('users').select('zip').is('deleted_at', null).not('is_test', 'is', true).gte('created_at', monthAgo).limit(2000),
  ]);
  const inMetro = (rows: any[] | null) => (rows ?? []).filter((u) => metroOf(u.zip) === metro).length;

  return NextResponse.json({ ok: true, city, count: inMetro(pool), recent: inMetro(fresh) });
}
