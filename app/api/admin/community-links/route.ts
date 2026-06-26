import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

// GET — pending (un-approved) community-link submissions for review.
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data } = await supabaseAdmin.from('friend_community_links')
    .select('id, title, url, kind, description, metro, is_test, created_at')
    .eq('approved', false).order('created_at', { ascending: false }).limit(100);
  return NextResponse.json({ pending: data ?? [] });
}

// POST { id, action: 'approve' | 'reject' } — gate a submission live, or drop it.
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, action } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (action === 'approve') {
    await supabaseAdmin.from('friend_community_links').update({ approved: true, approved_at: new Date().toISOString() }).eq('id', id);
  } else {
    await supabaseAdmin.from('friend_community_links').delete().eq('id', id);
  }
  return NextResponse.json({ ok: true });
}
