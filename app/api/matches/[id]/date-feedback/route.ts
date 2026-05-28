import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating))));
  if (!rating || isNaN(rating)) return NextResponse.json({ error: 'Rating 1-5 required' }, { status: 400 });

  const would_again = typeof body.would_again === 'boolean' ? body.would_again : null;
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null;

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('user_1_id, user_2_id')
    .eq('id', params.id)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  }

  // Submitting feedback does NOT end the match — review only, private to user + admin.
  const { error } = await supabaseAdmin.from('date_feedback').upsert(
    { match_id: params.id, user_id: user.id, rating, would_again, notes },
    { onConflict: 'match_id,user_id' }
  );

  if (error) {
    console.error('Date feedback error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
