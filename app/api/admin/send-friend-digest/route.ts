import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { runFriendDigest } from '@/lib/friend-digest';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin "send the Friend Line digest now". ?dry=1 previews (who/what would go),
// otherwise sends — ignoring the per-user 20h throttle since it's a deliberate
// manual send.
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const result = await runFriendDigest(dry ? { dry: true } : { ignoreThrottle: true });
  return NextResponse.json(result);
}
