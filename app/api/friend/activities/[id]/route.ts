import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Delete your own post/event (author only). RSVPs cascade via FK.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: act } = await supabaseAdmin
    .from('friend_activities').select('author_id').eq('id', params.id).maybeSingle();
  if (!act) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (act.author_id !== user.id) return NextResponse.json({ error: 'Not yours' }, { status: 403 });

  const { error } = await supabaseAdmin.from('friend_activities').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
