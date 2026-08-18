import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/**
 * Legacy safety endpoint. This URL used to email both sides of every pending
 * match on GET, bypassing preferences and idempotency. It is intentionally
 * preview-only now; the hourly Love concierge owns all transactional sends.
 */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { count, error } = await supabaseAdmin
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .is('ended_at', null);
  if (error) return NextResponse.json({ error: 'Could not load pending matches' }, { status: 500 });

  return NextResponse.json({
    ok: true,
    previewOnly: true,
    pendingMatches: count || 0,
    message: 'No email was sent. The Love concierge sends immediate, 24-hour, and near-expiry decision notifications automatically and idempotently.',
  });
}
