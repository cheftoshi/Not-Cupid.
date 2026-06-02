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
  if (match.ended_at) return NextResponse.json({ error: 'Match already ended' }, { status: 400 });

  const isUser1 = match.user_1_id === user.id;
  const isUser2 = match.user_2_id === user.id;
  if (!isUser1 && !isUser2) return NextResponse.json({ error: 'Not your match' }, { status: 403 });

  // One person passing ends it for both
  const { error } = await supabaseAdmin
    .from('matches')
    .update({
      ended_at: new Date().toISOString(),
      ended_reason: 'one_passed',
    })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Record in history to prevent re-match
  const a = match.user_1_id < match.user_2_id ? match.user_1_id : match.user_2_id;
  const b = match.user_1_id < match.user_2_id ? match.user_2_id : match.user_1_id;
  await supabaseAdmin.from('match_history').upsert(
    {
      user_a_id: a,
      user_b_id: b,
      match_id: params.id,
      outcome: 'one_passed',
      last_matched_at: new Date().toISOString(),
    },
    { onConflict: 'user_a_id,user_b_id' }
  );

  // Return both parties to the pool (else a stale 'matched' status strands them
  // on the roster — they see picks but can't claim).
  await supabaseAdmin.from('users').update({ status: 'waiting' }).in('id', [match.user_1_id, match.user_2_id]);

  return NextResponse.json({ success: true });
}
