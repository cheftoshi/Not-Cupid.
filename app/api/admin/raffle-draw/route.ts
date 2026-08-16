import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { drawRaffle } from '@/lib/raffle-draw';
import { raffleLaunchBlockers } from '@/lib/raffle';

export const dynamic = 'force-dynamic';

// Manual override: starts a launch-ready shortlist round before the normal
// public trigger, or resolves the collecting round when decisions permit it.
// It cannot bypass the code, database, or operational launch gates.
export async function POST() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const res = await drawRaffle({ force: true });
  return NextResponse.json({ ok: true, drawn: res.drawn, entrants: res.entrants, pairs: res.pairs ?? (res.pair ? [res.pair] : res.shortlist ?? []), roundNumber: res.roundNumber, message: res.state, launchBlockers: raffleLaunchBlockers() });
}
