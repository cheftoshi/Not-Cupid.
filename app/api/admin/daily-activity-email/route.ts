import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { runDailyActivityDigest } from '@/lib/daily-activity-digest';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Read-only live audience + exact-template preview. There is deliberately no
// admin send action; automatic delivery is controlled only by the two
// versioned production environment approvals.
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [preview, runs] = await Promise.all([
    runDailyActivityDigest({ send: false }),
    supabaseAdmin.from('activity_digest_runs').select('created_at,status,candidates,sent,failed,skipped_claimed').order('created_at', { ascending: false }).limit(30),
  ]);
  return NextResponse.json({ ...preview, recentRuns: runs.data || [], runHistoryAvailable: !runs.error });
}
