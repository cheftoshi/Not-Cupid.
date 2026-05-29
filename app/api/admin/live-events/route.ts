// GET /api/admin/live-events
//
// Returns the current live-events deck that's being served to users,
// PLUS the full blacklist so the admin can see what they've already
// hidden (and unhide if desired). The result is exactly what's flowing
// into the date-vibes deck right now — so the admin can spot-check.

import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchAllLiveActivities } from '@/lib/live-events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [items, blacklistRows] = await Promise.all([
    fetchAllLiveActivities(),
    supabaseAdmin
      .from('live_activity_blacklist')
      .select('activity_id, hidden_at, reason')
      .order('hidden_at', { ascending: false }),
  ]);

  // Group items by source for easier scanning in the admin UI.
  const grouped: Record<string, any[]> = { ticketmaster: [], yelp: [], 'boston-calendar': [] };
  for (const it of items) {
    if (!grouped[it.source]) grouped[it.source] = [];
    grouped[it.source].push(it);
  }

  return NextResponse.json({
    grouped,
    counts: {
      ticketmaster: grouped.ticketmaster?.length || 0,
      yelp: grouped.yelp?.length || 0,
      'boston-calendar': grouped['boston-calendar']?.length || 0,
      total: items.length,
    },
    blacklist: blacklistRows.data ?? [],
  });
}
