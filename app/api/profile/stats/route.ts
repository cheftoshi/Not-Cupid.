import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('user_1_id, user_2_id, user_1_accepted, user_2_accepted, status, ended_at, ended_reason')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`);

  const list = matches || [];
  const total = list.length;
  const accepted = list.filter(m => m.user_1_accepted && m.user_2_accepted).length;
  const passed = list.filter(m => m.status === 'passed' || m.ended_reason === 'one_passed').length;
  const active = list.filter(m => m.user_1_accepted && m.user_2_accepted && !m.ended_at).length;
  const pending = list.filter(m => {
    const isUser1 = m.user_1_id === user.id;
    const mine = isUser1 ? m.user_1_accepted : m.user_2_accepted;
    return !mine && !m.ended_at && m.status !== 'passed';
  }).length;

  return NextResponse.json({ total, accepted, passed, active, pending });
}
