import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleEligible, raffleClosed } from '@/lib/raffle';
import { signPrivateVideoReference } from '@/lib/private-media';

export const dynamic = 'force-dynamic';

// The caller's raffle state: eligible? entered? drawn into a pair? accepted?
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const eligible = user.is_test !== true && raffleEligible(user);
  const hasProfile = !!user.photo_url && !!user.archetype;

  let entered = false, entry: any = null, draw: any = null, other: any = null;
  try {
    const { data: e } = await supabaseAdmin.from('raffle_entries').select('status').eq('user_id', user.id).eq('event_key', RAFFLE.key).maybeSingle();
    if (e) { entered = e.status === 'entered' || e.status === 'picked'; entry = e; }

    const { data: draws } = await supabaseAdmin.from('raffle_draws').select('*')
      .eq('event_key', RAFFLE.key)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .in('status', ['pending', 'both_accepted'])
      .limit(1);
    const d = (draws ?? [])[0];
    if (d) {
      const isA = d.user_a_id === user.id;
      const otherId = isA ? d.user_b_id : d.user_a_id;
      const [{ data: o }, { data: otherEntry }] = await Promise.all([
        supabaseAdmin.from('users').select('name, age, photo_url, gallery, archetype').eq('id', otherId).single(),
        supabaseAdmin.from('raffle_entries').select('video_url, questionnaire').eq('event_key', RAFFLE.key).eq('user_id', otherId).maybeSingle(),
      ]);
      const introVideoPreviewUrl = await signPrivateVideoReference(
        (otherEntry as any)?.video_url,
        `${otherId}/${RAFFLE.key}-`,
      );
      draw = {
        id: d.id, status: d.status, score: d.compatibility_score,
        myAccepted: isA ? d.a_accepted : d.b_accepted,
        theyAccepted: isA ? d.b_accepted : d.a_accepted,
        bothAccepted: d.a_accepted && d.b_accepted,
        restaurant: d.restaurant, happensAt: d.happens_at,
      };
      other = o ? {
        name: o.name,
        age: o.age,
        photo_url: o.photo_url,
        gallery: Array.isArray(o.gallery) ? o.gallery.slice(0, 3) : [],
        archetype: o.archetype,
        introVideoPreviewUrl,
        conversationStarter: (otherEntry as any)?.questionnaire?.conversationStarter || null,
        energy: (otherEntry as any)?.questionnaire?.energy || null,
      } : null;
    }
  } catch { /* tables not migrated yet — show the register state */ }

  let spotsLeft = RAFFLE.cap;
  try {
    const { count } = await supabaseAdmin.from('raffle_entries').select('user_id', { count: 'exact', head: true }).eq('event_key', RAFFLE.key).neq('status', 'withdrawn');
    spotsLeft = Math.max(0, RAFFLE.cap - (count ?? 0));
  } catch { /* not migrated */ }

  return NextResponse.json({
    event: {
      series: RAFFLE.series, city: RAFFLE.city, dateLabel: RAFFLE.dateLabel, budget: RAFFLE.budget,
      tagline: RAFFLE.tagline, drawLabel: RAFFLE.drawLabel, cap: RAFFLE.cap, entryCloseLabel: RAFFLE.entryCloseLabel,
      statusLabel: RAFFLE.statusLabel, entriesOpen: RAFFLE.entriesOpen,
      radiusMiles: RAFFLE.radiusMiles, centerZip: RAFFLE.centerZip, termsVersion: RAFFLE.termsVersion,
      videoMinSeconds: RAFFLE.videoMinSeconds, videoMaxSeconds: RAFFLE.videoMaxSeconds, videoMaxBytes: RAFFLE.videoMaxBytes,
      spotsLeft, closed: raffleClosed() || spotsLeft === 0,
    },
    eligible, hasProfile, entered, entry, draw, other,
  });
}
