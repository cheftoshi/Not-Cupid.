import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { drawRaffle } from '@/lib/raffle-draw';

export const dynamic = 'force-dynamic';

// Manual override: starts a V2 shortlist round before the public trigger, or
// resolves the collecting round when all decisions/deadline permit it.
export async function POST() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const res = await drawRaffle({ force: true });
  return NextResponse.json({ ok: true, drawn: res.drawn, entrants: res.entrants, pairs: res.pair ? [res.pair] : res.shortlist ?? [], roundNumber: res.roundNumber, message: res.state });
}
