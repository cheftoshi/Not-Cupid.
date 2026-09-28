import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { friendLocationContext } from '@/lib/friend-location';
import { cityEvents } from '@/lib/city-events-server';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimit({ key: `city-events:${user.id}`, windowSec: 60, maxAttempts: 20, blockSec: 60 });
  if (!limit.ok) return NextResponse.json({ error: 'Please wait a moment before refreshing events.' }, { status: 429 });
  const location = await friendLocationContext(user);
  if (!location.metro) return NextResponse.json({ error: 'Choose a supported discovery city first.' }, { status: 400 });
  const result = await cityEvents(location.metro);
  return NextResponse.json({ ...result, metro: location.metro }, { headers: { 'Cache-Control': 'private, no-store' } });
}
