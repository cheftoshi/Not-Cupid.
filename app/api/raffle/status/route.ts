import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleEligible, raffleClosed } from '@/lib/raffle';

export const dynamic = 'force-dynamic';

// The caller's raffle state: eligible? entered? drawn into a pair? accepted?
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const eligible = raffleEligible(user);
  const hasProfile = !!user.photo_url && !!user.archetype;

  let entered = false, entry: any = null, draw: any = null, other: any = null;
  try {
    const { data: e } = await supabaseAdmin.from('raffle_entries').select('video_url, status').eq('user_id', user.id).eq('event_key', RAFFLE.key).maybeSingle();
    if (e) { entered = true; entry = e; }

    const { data: draws } = await supabaseAdmin.from('raffle_draws').select('*')
      .eq('event_key', RAFFLE.key)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .in('status', ['pending', 'both_accepted'])
      .limit(1);
    const d = (draws ?? [])[0];
    if (d) {
      const isA = d.user_a_id === user.id;
      const otherId = isA ? d.user_b_id : d.user_a_id;
      const { data: o } = await supabaseAdmin.from('users').select('name, age, photo_url, archetype').eq('id', otherId).single();
      draw = {
        id: d.id, status: d.status, score: d.compatibility_score,
        myAccepted: isA ? d.a_accepted : d.b_accepted,
        theyAccepted: isA ? d.b_accepted : d.a_accepted,
        bothAccepted: d.a_accepted && d.b_accepted,
        restaurant: d.restaurant, happensAt: d.happens_at,
      };
      other = o ? { name: o.name, age: o.age, photo_url: o.photo_url, archetype: o.archetype } : null;
    }
  } catch { /* tables not migrated yet — show the register state */ }

  let spotsLeft = RAFFLE.cap;
  try {
    const { count } = await supabaseAdmin.from('raffle_entries').select('user_id', { count: 'exact', head: true }).eq('event_key', RAFFLE.key);
    spotsLeft = Math.max(0, RAFFLE.cap - (count ?? 0));
  } catch { /* not migrated */ }

  return NextResponse.json({
    event: {
      series: RAFFLE.series, city: RAFFLE.city, dateLabel: RAFFLE.dateLabel, budget: RAFFLE.budget,
      tagline: RAFFLE.tagline, drawLabel: RAFFLE.drawLabel, cap: RAFFLE.cap, entryCloseLabel: RAFFLE.entryCloseLabel,
      statusLabel: RAFFLE.statusLabel, entriesOpen: RAFFLE.entriesOpen,
      spotsLeft, closed: raffleClosed() || spotsLeft === 0,
    },
    eligible, hasProfile, entered, entry, draw, other,
  });
}
