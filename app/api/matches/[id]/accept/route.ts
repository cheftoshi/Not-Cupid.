import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  const isUser1 = match.user_1_id === user.id;
  const isUser2 = match.user_2_id === user.id;
  if (!isUser1 && !isUser2) return NextResponse.json({ error: 'Not your match' }, { status: 403 });

  if (match.ended_at) return NextResponse.json({ error: 'Match already ended' }, { status: 400 });

  const updates: any = isUser1 ? { user_1_accepted: true } : { user_2_accepted: true };

  // If this acceptance completes the mutual accept, open the chat window
  const bothWillBeAccepted = isUser1 ? match.user_2_accepted : match.user_1_accepted;
  if (bothWillBeAccepted) {
    updates.chat_expires_at = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
  }

  const { error } = await supabaseAdmin.from('matches').update(updates).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
