import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleEligible } from '@/lib/raffle';
import { signPrivateVideoReference } from '@/lib/private-media';
import { experimentOrientationLabel } from '@/lib/experiment-preferences';
import { datingExperimentDateLabel, datingExperimentEntriesOpen, getDatingExperimentEvent } from '@/lib/dating-experiment-event';

export const dynamic = 'force-dynamic';

async function privateCandidate(candidateId: string) {
  const [{ data: profile }, { data: entry }] = await Promise.all([
    supabaseAdmin.from('users').select('name, age, photo_url, gallery, archetype').eq('id', candidateId).single(),
    supabaseAdmin.from('raffle_entries').select('video_url, questionnaire').eq('event_key', RAFFLE.key).eq('user_id', candidateId).maybeSingle(),
  ]);
  if (!profile) return null;
  const introVideoPreviewUrl = await signPrivateVideoReference(
    (entry as any)?.video_url,
    `${candidateId}/${RAFFLE.key}-`,
  );
  return {
    name: profile.name,
    age: profile.age,
    photo_url: profile.photo_url,
    gallery: Array.isArray(profile.gallery) ? profile.gallery.slice(0, 3) : [],
    archetype: profile.archetype,
    orientation: experimentOrientationLabel((entry as any)?.questionnaire?.preferences?.orientation),
    introVideoPreviewUrl,
    conversationStarter: (entry as any)?.questionnaire?.conversationStarter || null,
    energy: (entry as any)?.questionnaire?.energy || null,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const event = await getDatingExperimentEvent();
  const eventLocation = event
    ? { centerZip: event.center_zip, radiusMiles: Number(event.radius_miles) }
    : RAFFLE;
  const entriesOpen = datingExperimentEntriesOpen(event);
  const eligible = user.is_test !== true && raffleEligible(user, eventLocation);
  const hasProfile = !!user.photo_url && !!user.archetype;
  let entered = false, entry: any = null, draw: any = null, other: any = null;
  let shortlist: any[] = [], shortlistRound: any = null;

  try {
    const { data: ownEntry } = await supabaseAdmin.from('raffle_entries')
      .select('status, terms_version')
      .eq('user_id', user.id)
      .eq('event_key', RAFFLE.key)
      .maybeSingle();
    if (ownEntry) {
      const currentEntry = ownEntry.terms_version === RAFFLE.termsVersion;
      entered = currentEntry && (ownEntry.status === 'entered' || ownEntry.status === 'picked');
      entry = currentEntry ? ownEntry : { status: 'needs-preference-refresh' };
    }

    const { data: offerRows } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
      .select('id, round_id, user_a_id, user_b_id, compatibility_score, a_accepted, b_accepted, a_favorite, b_favorite, created_at')
      .eq('event_key', RAFFLE.key)
      .eq('status', 'pending')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    const activeRoundId = offerRows?.[0]?.round_id;
    const activeOffers = activeRoundId ? (offerRows ?? []).filter((row) => row.round_id === activeRoundId) : [];
    if (activeRoundId) {
      const { data: round } = await supabaseAdmin.from('dating_experiment_rounds')
        .select('id, round_number, status, response_deadline')
        .eq('id', activeRoundId)
        .in('status', ['collecting', 'resolving'])
        .maybeSingle();
      if (round) {
        shortlist = (await Promise.all(activeOffers.map(async (offer) => {
          const isA = offer.user_a_id === user.id;
          const candidateId = isA ? offer.user_b_id : offer.user_a_id;
          return {
            id: offer.id,
            score: offer.compatibility_score,
            myAccepted: isA ? offer.a_accepted : offer.b_accepted,
            myFavorite: isA ? offer.a_favorite : offer.b_favorite,
            candidate: await privateCandidate(candidateId),
          };
        }))).filter((offer) => offer.candidate != null);
        shortlistRound = {
          id: round.id,
          roundNumber: round.round_number,
          status: round.status,
          responseDeadline: round.response_deadline,
          allResponded: shortlist.length > 0 && shortlist.every((offer) => offer.myAccepted !== null),
        };
      }
    }

    const { data: draws } = await supabaseAdmin.from('raffle_draws').select('*')
      .eq('event_key', RAFFLE.key)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .in('status', ['pending', 'both_accepted'])
      .order('created_at', { ascending: false })
      .limit(1);
    const latestDraw = draws?.[0];
    if (latestDraw) {
      const isA = latestDraw.user_a_id === user.id;
      const otherId = isA ? latestDraw.user_b_id : latestDraw.user_a_id;
      draw = {
        id: latestDraw.id,
        status: latestDraw.status,
        score: latestDraw.compatibility_score,
        myAccepted: isA ? latestDraw.a_accepted : latestDraw.b_accepted,
        theyAccepted: isA ? latestDraw.b_accepted : latestDraw.a_accepted,
        bothAccepted: latestDraw.a_accepted && latestDraw.b_accepted,
        restaurant: latestDraw.restaurant,
        happensAt: latestDraw.happens_at,
      };
      other = await privateCandidate(otherId);
    }
  } catch (error) {
    console.error('[dating-experiment-status]', error);
  }

  const eventCap = event?.entry_cap ?? RAFFLE.cap;
  let spotsLeft = eventCap;
  try {
    const { count } = await supabaseAdmin.from('raffle_entries')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_key', RAFFLE.key)
      .neq('status', 'withdrawn');
    spotsLeft = Math.max(0, eventCap - (count ?? 0));
  } catch { /* migration not ready */ }

  return NextResponse.json({
    event: {
      series: event?.public_name ?? RAFFLE.series, city: event?.city ?? RAFFLE.city, dateLabel: datingExperimentDateLabel(event), budget: (event?.prize_per_pair_cents ?? RAFFLE.budget * 100) / 100,
      tagline: RAFFLE.tagline, drawLabel: RAFFLE.drawLabel, cap: eventCap, entryCloseLabel: RAFFLE.entryCloseLabel,
      statusLabel: RAFFLE.statusLabel, entriesOpen,
      radiusMiles: Number(event?.radius_miles ?? RAFFLE.radiusMiles), centerZip: event?.center_zip ?? RAFFLE.centerZip, termsVersion: event?.terms_version ?? RAFFLE.termsVersion,
      videoMinSeconds: RAFFLE.videoMinSeconds, videoMaxSeconds: RAFFLE.videoMaxSeconds, videoMaxBytes: RAFFLE.videoMaxBytes,
      shortlistMaxOptions: event?.shortlist_max_options ?? RAFFLE.shortlistMaxOptions,
      winnerPairCount: event?.winner_pair_limit ?? RAFFLE.winnerPairCount,
      dateOptions: event?.dinner_dates.map((date) => ({ key: date.event_date, label: date.public_label })) ?? RAFFLE.dateOptions,
      spotsLeft, closed: !entriesOpen || spotsLeft === 0,
    },
    eligible, hasProfile, entered, entry, shortlist, shortlistRound, draw, other,
  });
}
