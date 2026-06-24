import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleEligible, raffleClosed } from '@/lib/raffle';
import { drawRaffle } from '@/lib/raffle-draw';

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

  // New entrants face the deadline + the 50-cap; updating your own entry doesn't.
  const { data: mine } = await supabaseAdmin.from('raffle_entries').select('user_id').eq('user_id', user.id).eq('event_key', RAFFLE.key).maybeSingle();
  const alreadyIn = !!mine;
  if (!alreadyIn) {
    if (raffleClosed()) return NextResponse.json({ error: 'Entries are closed for this one — watch the hub for the next.' }, { status: 400 });
    const { count } = await supabaseAdmin.from('raffle_entries').select('user_id', { count: 'exact', head: true }).eq('event_key', RAFFLE.key);
    if ((count ?? 0) >= RAFFLE.cap) return NextResponse.json({ error: 'The raffle just hit capacity — watch the hub for the next one.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('raffle_entries').upsert(
    { user_id: user.id, event_key: RAFFLE.key, video_url, notify, status: 'entered' },
    { onConflict: 'user_id,event_key' }
  );
  if (error) {
    console.error('raffle enter error', error);
    return NextResponse.json({ error: 'Could not enter — try again.' }, { status: 500 });
  }

  // Hit the cap on this entry → auto-draw immediately (the algo does the rest).
  if (!alreadyIn) {
    const { count: now } = await supabaseAdmin.from('raffle_entries').select('user_id', { count: 'exact', head: true }).eq('event_key', RAFFLE.key).eq('status', 'entered');
    if ((now ?? 0) >= RAFFLE.cap) await drawRaffle().catch((e) => console.error('cap auto-draw failed', e));
  }
  return NextResponse.json({ ok: true });
}
