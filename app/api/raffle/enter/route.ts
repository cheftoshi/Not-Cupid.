import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleEligible } from '@/lib/raffle';

export const dynamic = 'force-dynamic';

// Enter the raffle. Needs a real profile (photo + finished quiz) and to be in the
// event's city. The contest video is encouraged but not hard-required so a
// storage hiccup never blocks a registration.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!raffleEligible(user)) return NextResponse.json({ error: `${RAFFLE.city} only for this one — change your city to ${RAFFLE.city} to enter.` }, { status: 400 });
  if (!user.photo_url || !user.archetype) return NextResponse.json({ error: 'Add a photo + finish the quiz first so we can match you.' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const video_url = body.video_url ? String(body.video_url).slice(0, 2000) : null;
  const notify = body.notify !== false;

  const { error } = await supabaseAdmin.from('raffle_entries').upsert(
    { user_id: user.id, event_key: RAFFLE.key, video_url, notify, status: 'entered' },
    { onConflict: 'user_id,event_key' }
  );
  if (error) {
    console.error('raffle enter error', error);
    return NextResponse.json({ error: 'Could not enter — try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
