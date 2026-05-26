import { NextResponse } from 'next/server';
import { getCurrentUser, destroySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabaseAdmin
    .from('users')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'deleted',
    })
    .eq('id', user.id);

  await supabaseAdmin
    .from('matches')
    .update({
      ended_at: new Date().toISOString(),
      ended_reason: 'user_deleted',
    })
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .is('ended_at', null);

  await destroySession();

  return NextResponse.json({ success: true });
}
