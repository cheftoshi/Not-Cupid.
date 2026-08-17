import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { dailyActivityEmailActivation } from '@/lib/daily-activity-email';
import { runDailyActivityDigest } from '@/lib/daily-activity-digest';
import { isAuthorizedCronRequest } from '@/lib/request-security';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// One consolidated daily Love + Friend drop. The Vercel schedule can safely
// exist before launch: send remains false until the exact template version and
// standing automatic-send policy are both recorded in production env.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const activation = dailyActivityEmailActivation();
  return NextResponse.json(await runDailyActivityDigest({ send: activation.enabled }));
}
