import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { drawRaffle } from '@/lib/raffle-draw';

export const dynamic = 'force-dynamic';

// Manual override / test trigger. The real draw is automatic (cap-100 on entry,
// or the hourly cron once entries close) — this forces the same shared draw on
// demand, even before the deadline (force: true).
export async function POST() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const res = await drawRaffle({ force: true });
  return NextResponse.json({ ok: true, drawn: res.drawn, entrants: res.entrants, pairs: res.pair ? [res.pair] : [], message: res.state });
}
