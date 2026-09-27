import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASONS = ['harassment', 'inappropriate_messages', 'fake_profile', 'offensive_photos', 'made_me_uncomfortable', 'other'];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !UUID.test(body.reportedId) || !UUID.test(body.contextId) ||
      !['dm', 'circle', 'club', 'plan'].includes(body.contextType) || !REASONS.includes(body.reason)) {
    return NextResponse.json({ error: 'Choose a conversation and report reason.' }, { status: 400 });
  }
  const limit = await rateLimit({ key: `friend-report:${user.id}`, windowSec: 3600, maxAttempts: 20 });
  if (!limit.ok) return NextResponse.json({ error: 'Please try again later.' }, { status: 429 });
  const { data, error } = await supabaseAdmin.rpc('report_friend_context', {
    p_reporter: user.id, p_reported: body.reportedId, p_kind: body.contextType,
    p_context: body.contextId, p_reason: body.reason, p_detail: String(body.detail ?? '').slice(0, 2000),
  });
  if (error) return NextResponse.json({ error: 'Could not save the report. Please retry.' }, { status: 503 });
  if (!data) return NextResponse.json({ error: 'Conversation unavailable.' }, { status: 403 });
  return NextResponse.json({ success: true });
}
