import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { runFriendDigest } from '@/lib/friend-digest';
import { isAuthorizedCronRequest } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

// Daily "what's up on the Friend Line" digest. Auth via Vercel's cron bearer
// or an admin session. Per-user ~20h throttle lives in the
// shared runFriendDigest().
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await runFriendDigest({});
  return NextResponse.json(result);
}
