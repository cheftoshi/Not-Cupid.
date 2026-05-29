import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const matchId = req.nextUrl.searchParams.get('match_id');
  if (!matchId) return NextResponse.json({ error: 'match_id required' }, { status: 400 });

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('user_1_id, user_2_id, chat_expires_at, ended_at, ended_reason, status')
    .eq('id', matchId)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  }

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  // Return live match status alongside messages so the chat header can
  // auto-update (countdown ticking, or "ended" if the other person bailed).
  return NextResponse.json({
    messages: messages || [],
    match: {
      chat_expires_at: match.chat_expires_at,
      ended_at: match.ended_at,
      ended_reason: match.ended_reason,
      status: match.status,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { match_id, body } = await req.json();
  if (!match_id || !body || typeof body !== 'string') {
    return NextResponse.json({ error: 'match_id and body required' }, { status: 400 });
  }
  if (body.trim().length === 0) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  }
  if (body.length > 2000) {
    return NextResponse.json({ error: 'Message too long (max 2000)' }, { status: 400 });
  }

  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', match_id)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 });
  }
  if (!match.user_1_accepted || !match.user_2_accepted) {
    return NextResponse.json({ error: 'Match not active' }, { status: 400 });
  }
  if (match.chat_expires_at && new Date(match.chat_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Chat expired' }, { status: 400 });
  }

  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .insert({
      match_id,
      sender_id: user.id,
      body: body.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error('Insert message error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Slide the inactivity window forward: an active chat never expires; it
  // only closes after 24h of silence (the rematch cron sweeps stale ones).
  await supabaseAdmin
    .from('matches')
    .update({ chat_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', match_id);

  // Per product call: chat stays in-app, no email-on-message. The
  // match_notifications throttle table is left in the schema in case we
  // re-enable later; it's currently unused.

  return NextResponse.json({ message });
}
