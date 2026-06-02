import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { runFriendDigest } from '@/lib/friend-digest';

export const dynamic = 'force-dynamic';

// Daily "what's up on the Friend Line" digest. Auth via Vercel's cron UA (per
// project convention) or an admin session. Per-user ~20h throttle lives in the
// shared runFriendDigest().
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const userAgent = req.headers.get('user-agent') || '';
  const isVercelCron = (!!cronSecret && authHeader === `Bearer ${cronSecret}`) || /vercel-cron/i.test(userAgent);
  if (!isVercelCron) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await runFriendDigest({});
  return NextResponse.json(result);
}
