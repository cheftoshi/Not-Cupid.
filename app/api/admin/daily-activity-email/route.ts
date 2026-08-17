import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { runDailyActivityDigest } from '@/lib/daily-activity-digest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Read-only live audience + exact-template preview. There is deliberately no
// admin send action; automatic delivery is controlled only by the two
// versioned production environment approvals.
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await runDailyActivityDigest({ send: false }));
}
