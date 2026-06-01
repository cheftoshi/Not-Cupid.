// POST /api/profile/reactivate
//
// The gentle, NON-destructive way back for a paused/ghosted user: lifts the
// matching pause without wiping their quiz/profile/matches and without spending
// one of their 3 lifetime "start fresh" refreshes. Clears the ghost penalty
// state on BOTH lines and drops them back into the waiting pool.
//
// (Beta posture: a clean slate every time. If serial-ghosting becomes a real
// problem we can escalate — e.g. keep a strike count that reactivate can't zero.)

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isHardLocked, GHOST_SUPPORT_EMAIL } from '@/lib/ghost';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Repeat ghosters past the hard cap can't self-reactivate — admin restore only.
  if (isHardLocked(user.ghost_strikes)) {
    return NextResponse.json(
      { error: `Your account is paused for repeated ghosting. Email ${GHOST_SUPPORT_EMAIL} to restore it.`, hardLocked: true },
      { status: 403 }
    );
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      matching_disabled_at: null,
      matching_cooldown_until: null,
      // Zero only the SOFT counter — ghost_strikes is permanent so the
      // escalation ladder survives a reactivate.
      ghost_reports_received: 0,
      status: 'waiting',
      pool_active: true,
    })
    .eq('id', user.id);

  if (error) {
    console.error('reactivate error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
