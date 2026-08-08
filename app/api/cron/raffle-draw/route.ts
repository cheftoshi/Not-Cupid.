import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { drawRaffle } from '@/lib/raffle-draw';
import { isAuthorizedCronRequest } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

// Hourly heartbeat. The shared engine starts a reciprocal shortlist after the
// public trigger, waits for sealed decisions, and resolves up to two disjoint
// mutual dinner pairs after everyone responds or the deadline passes. No-op while paused.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const res = await drawRaffle();
  return NextResponse.json(res);
}
