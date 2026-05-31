import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('user_1_id, user_2_id, user_1_accepted, user_2_accepted, status, ended_at, ended_reason, expires_at, chat_expires_at')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`);

  const list = matches || [];
  const now = Date.now();
  const isTerminal = (m: any) => !!m.ended_at || ['ended', 'passed', 'expired'].includes(m.status);

  const total = list.length;
  const accepted = list.filter(m => m.user_1_accepted && m.user_2_accepted).length;
  const passed = list.filter(m => m.status === 'passed' || m.ended_reason === 'one_passed').length;

  // "active" = genuinely LIVE: both accepted, not terminal, chat not gone
  // silent past its window. (A both-accepted match whose chat expired but
  // the cron hasn't set ended_at yet must NOT count — that was the "1 active"
  // vs "in queue" mismatch.)
  const active = list.filter(m =>
    m.user_1_accepted && m.user_2_accepted && !isTerminal(m) &&
    (!m.chat_expires_at || new Date(m.chat_expires_at).getTime() > now)
  ).length;

  // "pending" = I haven't acted yet, still inside the accept window, not terminal.
  const pending = list.filter(m => {
    if (isTerminal(m)) return false;
    if (m.expires_at && new Date(m.expires_at).getTime() <= now) return false;
    const mine = m.user_1_id === user.id ? m.user_1_accepted : m.user_2_accepted;
    return !mine;
  }).length;

  return NextResponse.json({ total, accepted, passed, active, pending });
}
