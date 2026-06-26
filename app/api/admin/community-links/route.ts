import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin';
import { sendPushToUser } from '@/lib/push';

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
    const { data: link } = await supabaseAdmin.from('friend_community_links').select('submitter_id, title').eq('id', id).maybeSingle();
    await supabaseAdmin.from('friend_community_links').update({ approved: true, approved_at: new Date().toISOString() }).eq('id', id);
    if (link?.submitter_id) {
      await sendPushToUser(link.submitter_id, { title: 'your community hub is live 🎉', body: `“${link.title}” is now in City Pulse — others can join it.`, url: '/friends?view=pulse', tag: `comlink-${id}` }).catch(() => {});
    }
  } else {
    await supabaseAdmin.from('friend_community_links').delete().eq('id', id);
  }
  return NextResponse.json({ ok: true });
}
