import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { recordMonetizationEvent } from '@/lib/monetization';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = await rateLimit({
    key: `monetization-view:${user.id}`,
    windowSec: 86_400,
    maxAttempts: 30,
    blockSec: 600,
  });
  if (!limit.ok) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => ({}));
  if (body.product !== 'friend_pack' || !['friend_pack_revealed', 'friend_pack_empty'].includes(body.surface)) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  }

  if (!(user as any).is_test) {
    await recordMonetizationEvent({
      userId: user.id,
      event: 'paywall_viewed',
      product: 'friend_pack',
      surface: body.surface,
      amountCents: 99,
    });
  }
  return NextResponse.json({ ok: true });
}
