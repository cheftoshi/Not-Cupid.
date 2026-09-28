import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { METRO_ZIP, METRO_CENTERS, metroOf } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

// Plan discovery is independent of home location. Only the explicit Love/home
// control changes the matching ZIP; neither operation deletes connections.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { metro, scope } = await req.json().catch(() => ({}));
  const zip = METRO_ZIP[metro as keyof typeof METRO_ZIP];
  if (!zip) return NextResponse.json({ error: 'Unknown city' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('users')
    .update(scope === 'home'
      ? { zip, roster_snapshot: [], roster_refreshed_at: null }
      : { discovery_metro: metro })
    .eq('id', user.id);
  if (error) {
    console.error('set-city failed', error);
    return NextResponse.json({ error: 'Could not change city' }, { status: 500 });
  }

  const m = metroOf(zip);
  const city = m && METRO_CENTERS[m] ? `${METRO_CENTERS[m].city}, ${METRO_CENTERS[m].state}` : null;
  return NextResponse.json({ ok: true, city, metro });
}
