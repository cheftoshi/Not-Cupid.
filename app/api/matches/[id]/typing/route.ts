import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { pairAllowed } from '@/lib/pair-safety';

export const dynamic = 'force-dynamic';

// Lightweight typing ping — the client throttles to 1 per 2.5s while composing.
// The message poll carries the other side's timestamp back; the bubble shows
// while it's fresh (<6s), so nothing ever needs clearing.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: match } = await supabaseAdmin
    .from('matches').select('user_1_id, user_2_id, ended_at, status, user_1_accepted, user_2_accepted').eq('id', id).maybeSingle();
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  }

  const col = match.user_1_id === user.id ? 'user_1_typing_at' : 'user_2_typing_at';
  if (match.ended_at || ['ended','passed','expired'].includes(match.status) ||
      !match.user_1_accepted || !match.user_2_accepted) {
    return NextResponse.json({ error: 'Conversation unavailable' }, { status: 409 });
  }
  try {
    if (!await pairAllowed(user, match.user_1_id === user.id ? match.user_2_id : match.user_1_id)) {
      return NextResponse.json({ error: 'Conversation unavailable' }, { status: 403 });
    }
  } catch { return NextResponse.json({ error: 'Safety checks unavailable' }, { status: 503 }); }
  const { error } = await supabaseAdmin.from('matches').update({ [col]: new Date().toISOString() }).eq('id', id).is('ended_at', null);
  if (error) return NextResponse.json({ error: 'Presence unavailable' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
