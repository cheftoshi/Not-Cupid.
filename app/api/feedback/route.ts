import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  // Feedback is open to logged-in users (the dashboard spot); anonymous is
  // fine too if we ever surface it elsewhere — user_id just stays null.

  const limit = await rateLimit({ key: `feedback:${user?.id || getClientIp(req)}`, windowSec: 3600, maxAttempts: 10, blockSec: 3600 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });

  const { body } = await req.json().catch(() => ({ body: null }));
  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'Empty feedback' }, { status: 400 });
  }
  if (body.length > 4000) {
    return NextResponse.json({ error: 'Too long (max 4000 chars)' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('feedback').insert({
    user_id: user?.id ?? null,
    body: body.trim(),
  });

  if (error) {
    console.error('Feedback insert failed:', error);
    return NextResponse.json({ error: 'Could not save feedback' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
