import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// GET: returns total count of users on the waitlist (for the public-facing stat)
export async function GET(req: NextRequest) {
  const limit = await rateLimit({ key: `friend-waitlist:${getClientIp(req)}`, windowSec: 60, maxAttempts: 30, blockSec: 60 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  }
  const { count } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .not('friend_waitlist_at', 'is', null);
  return NextResponse.json({ count: count ?? 0 });
}

// POST: authenticated user joins the waitlist (idempotent — won't overwrite if already joined)
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.friend_waitlist_at) {
    return NextResponse.json({ success: true, alreadyJoined: true });
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ friend_waitlist_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    console.error('Friend waitlist error:', error);
    return NextResponse.json({ error: 'Could not join the waitlist' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
