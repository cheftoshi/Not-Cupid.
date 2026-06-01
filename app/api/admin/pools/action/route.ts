// POST /api/admin/pools/action   { action, userId }
//
// Manual admin overrides on the dating pool:
//   - release_cooldown — clear an active cooldown early, return to pool
//   - lift_ban        — clear a permanent ban, reset ghost counter, return to pool
//
// Both reactivate the user (status=waiting, pool_active=true) so they're
// immediately matchable again. The daily cron will also pick them up.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Action = 'release_cooldown' | 'lift_ban';
const VALID: Action[] = ['release_cooldown', 'lift_ban'];

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = body?.action as Action;
  const userId = typeof body?.userId === 'string' ? body.userId : null;

  if (!userId || !VALID.includes(action)) {
    return NextResponse.json({ error: 'action + userId required' }, { status: 400 });
  }

  const updates: Record<string, any> =
    action === 'release_cooldown'
      ? {
          matching_cooldown_until: null,
          status: 'waiting',
          pool_active: true,
        }
      : {
          // lift_ban — clean slate (also zero the permanent strike count, or a
          // hard-locked user would re-lock the instant they're reactivated).
          matching_disabled_at: null,
          matching_cooldown_until: null,
          ghost_reports_received: 0,
          ghost_strikes: 0,
          status: 'waiting',
          pool_active: true,
        };

  const { error } = await supabaseAdmin.from('users').update(updates).eq('id', userId);
  if (error) {
    console.error('pools/action error', { action, userId, error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
