import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { drawRaffle } from '@/lib/raffle-draw';
import { raffleClosed, RAFFLE } from '@/lib/raffle';

export const dynamic = 'force-dynamic';

// Daily — once the entry deadline passes, auto-draw any remaining eligible
// entrants. Idempotent (already-drawn people are skipped), so it's safe to run
// every day. Auth via the Vercel cron user-agent (see CRON_SECRET gotcha).
export async function GET(req: NextRequest) {
  const ua = req.headers.get('user-agent') || '';
  const isCron = ua.includes('vercel-cron');
  const admin = await getCurrentAdmin();
  if (!isCron && !admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!raffleClosed()) {
    return NextResponse.json({ ok: true, skipped: 'entries still open', closes: RAFFLE.entryClose });
  }
  const res = await drawRaffle();
  return NextResponse.json(res);
}
