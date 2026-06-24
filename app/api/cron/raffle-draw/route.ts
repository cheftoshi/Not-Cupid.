import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { drawRaffle } from '@/lib/raffle-draw';

export const dynamic = 'force-dynamic';

// Hourly heartbeat. drawRaffle() self-gates — it only draws once entries close or
// the cap is hit, and it expires a stale (no-show) pending draw and re-draws so a
// round can't deadlock. A no-op the rest of the time. Auth via the Vercel cron
// user-agent (see CRON_SECRET gotcha).
export async function GET(req: NextRequest) {
  const ua = req.headers.get('user-agent') || '';
  const isCron = ua.includes('vercel-cron');
  const admin = await getCurrentAdmin();
  if (!isCron && !admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const res = await drawRaffle();
  return NextResponse.json(res);
}
