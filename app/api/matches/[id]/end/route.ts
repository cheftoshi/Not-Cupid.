import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { returnLovePickEntitlement } from '@/lib/love-pick-access';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const reason = ['ghosted', 'not_vibing', 'user_ended'].includes(body?.reason) ? body.reason : 'user_ended';
  const { id } = await params;
  const { data, error } = await supabaseAdmin.rpc('end_love_match_safely', {
    p_match: id, p_user: user.id, p_reason: reason,
  });
  if (error) return NextResponse.json({ error: 'Could not end match' }, { status: 503 });
  if (!data) return NextResponse.json({ error: 'Match unavailable' }, { status: 404 });
  // Entitlement returns are idempotent; retrying after a network failure is safe.
  if (!data.was_mutual) await returnLovePickEntitlement(id, user.id);
  return NextResponse.json({ success: true, alreadyEnded: !data.changed });
}
