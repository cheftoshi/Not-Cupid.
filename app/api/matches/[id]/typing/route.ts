import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Lightweight typing ping — the client throttles to 1 per 2.5s while composing.
// The message poll carries the other side's timestamp back; the bubble shows
// while it's fresh (<6s), so nothing ever needs clearing.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: match } = await supabaseAdmin
    .from('matches').select('user_1_id, user_2_id').eq('id', id).maybeSingle();
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  }

  const col = match.user_1_id === user.id ? 'user_1_typing_at' : 'user_2_typing_at';
  // Graceful pre-migration: if the typing columns don't exist yet this update
  // errors — swallow it, the feature just stays dormant.
  await supabaseAdmin.from('matches').update({ [col]: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ ok: true });
}
