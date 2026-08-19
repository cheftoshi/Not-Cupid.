import { NextResponse } from 'next/server';
import { getCurrentUser, destroySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: deactivated, error } = await supabaseAdmin.rpc('deactivate_notcupid_account', {
    p_user_id: user.id,
  });
  if (error || deactivated !== true) {
    console.error('[profile-delete] deactivation failed', { code: error?.code });
    return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 });
  }

  await destroySession();

  return NextResponse.json({ success: true });
}
