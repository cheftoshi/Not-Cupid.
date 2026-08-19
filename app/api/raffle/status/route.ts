import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleEligible } from '@/lib/raffle';
import { signPrivateVideoReference } from '@/lib/private-media';
import { experimentOrientationLabel } from '@/lib/experiment-preferences';
import { datingExperimentAdminRehearsalOpen, datingExperimentDateLabel, datingExperimentEntriesOpen, getDatingExperimentEvent } from '@/lib/dating-experiment-event';
import { experimentProfileReadiness } from '@/lib/experiment-profile';
import { getAdminEmails } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const answerLabel = (value: unknown, labels: Record<string, string>) => labels[String(value)] ?? null;
const normalizedInterests = (profile: any): string[] => [
  ...(Array.isArray(profile?.hobbies) ? profile.hobbies : []),
  ...(Array.isArray(profile?.music) ? profile.music : []),
  ...(Array.isArray(profile?.food) ? profile.food : []),
  ...(Array.isArray(profile?.sports) ? profile.sports : []),
].map((value) => String(value).trim()).filter(Boolean);

async function privateCandidate(candidateId: string, viewer: any) {
  const [{ data: profile, error: profileError }, { data: entry, error: entryError }] = await Promise.all([
    supabaseAdmin.from('users').select('name, age, photo_url, gallery, archetype, bio, hobbies, music, food, sports, is_test, is_blocked, deleted_at').eq('id', candidateId).single(),
    supabaseAdmin.from('raffle_entries').select('video_url, questionnaire').eq('event_key', RAFFLE.key).eq('user_id', candidateId).maybeSingle(),
  ]);
  if (profileError) throw profileError;
  if (entryError) throw entryError;
  if (!profile || profile.is_test || profile.is_blocked || profile.deleted_at) return null;
  const viewerInterests = new Set(normalizedInterests(viewer).map((value) => value.toLowerCase()));
  const sharedInterests = normalizedInterests(profile)
    .filter((value) => viewerInterests.has(value.toLowerCase()))
    .filter((value, index, all) => all.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .slice(0, 4);
  const answers = (entry as any)?.questionnaire ?? {};
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
    bio: String(profile.bio || '').trim().slice(0, 320) || null,
    sharedInterests,
    orientation: experimentOrientationLabel((entry as any)?.questionnaire?.preferences?.orientation),
    introVideoPreviewUrl,
    conversationStarter: answers.conversationStarter || null,
    intention: answerLabel(answers.intention, { relationship: 'a relationship', intentional: 'intentional dating', open: 'open, but real' }),
    energy: answerLabel(answers.energy, { conversation: 'deep conversation', playful: 'playful + easy', foodie: 'food-first adventure' }),
    planningStyle: answerLabel(answers.planningStyle, { planned: 'a clear plan', spontaneous: 'go with the flow', flexible: 'either works' }),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const event = await getDatingExperimentEvent();
  const eventLocation = event
    ? { centerZip: event.center_zip, radiusMiles: Number(event.radius_miles) }
    : RAFFLE;
  const rehearsal = datingExperimentAdminRehearsalOpen(event, user);
  const entriesOpen = datingExperimentEntriesOpen(event) || rehearsal;
  const adminEmails = new Set(getAdminEmails());
  const eligible = user.is_test !== true
    && user.is_blocked !== true
    && !user.deleted_at
    && !adminEmails.has(String(user.email || '').trim().toLowerCase())
    && raffleEligible(user, eventLocation);
  const profileReadiness = experimentProfileReadiness(user);
  const hasProfile = profileReadiness.complete;
  let entered = false, entry: any = null, draw: any = null, other: any = null;
  let shortlist: any[] = [], shortlistRound: any = null;

  try {
    const { data: ownEntry, error: ownEntryError } = await supabaseAdmin.from('raffle_entries')
      .select('status, terms_version')
      .eq('user_id', user.id)
      .eq('event_key', RAFFLE.key)
      .maybeSingle();
    if (ownEntryError) throw ownEntryError;
    if (ownEntry) {
      const currentEntry = ownEntry.terms_version === RAFFLE.termsVersion;
      entered = currentEntry && (ownEntry.status === 'entered' || ownEntry.status === 'picked');
      entry = currentEntry ? ownEntry : { status: 'needs-preference-refresh' };
    }

    const { data: offerRows, error: offerRowsError } = await supabaseAdmin.from('dating_experiment_shortlist_pairs')
      .select('id, round_id, user_a_id, user_b_id, compatibility_score, a_accepted, b_accepted, a_favorite, b_favorite, created_at')
      .eq('event_key', RAFFLE.key)
      .eq('status', 'pending')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    if (offerRowsError) throw offerRowsError;
    const { data: currentRound, error: currentRoundError } = await supabaseAdmin.from('dating_experiment_rounds')
      .select('id, round_number, status, response_deadline')
      .eq('event_key', RAFFLE.key)
      .in('status', ['collecting', 'resolving'])
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentRoundError) throw currentRoundError;
    const activeRoundId = currentRound?.id;
    const activeOffers = activeRoundId ? (offerRows ?? []).filter((row) => row.round_id === activeRoundId) : [];
    if (currentRound) {
        let feedbackByPair = new Map<string, string>();
        let behaviorComplete = false;
        if (activeOffers.length) {
          const [feedbackResult, behaviorResult] = await Promise.all([
            supabaseAdmin.from('dating_experiment_decision_feedback')
              .select('pair_id, reason_code')
              .eq('round_id', currentRound.id)
              .eq('user_id', user.id),
            supabaseAdmin.from('dating_experiment_participant_events')
              .select('event_type')
              .eq('round_id', currentRound.id)
              .eq('user_id', user.id)
              .in('event_type', ['feedback_submitted', 'feedback_skipped']),
          ]);
          if (feedbackResult.error) console.error('[dating-experiment-feedback-status]', feedbackResult.error);
          if (behaviorResult.error) console.error('[dating-experiment-behavior-status]', behaviorResult.error);
          feedbackByPair = new Map((feedbackResult.data ?? []).map((row) => [row.pair_id, row.reason_code]));
          behaviorComplete = (behaviorResult.data ?? []).length > 0;
        }
        shortlist = (await Promise.all(activeOffers.map(async (offer) => {
          const isA = offer.user_a_id === user.id;
          const candidateId = isA ? offer.user_b_id : offer.user_a_id;
          return {
            id: offer.id,
            score: offer.compatibility_score,
            myAccepted: isA ? offer.a_accepted : offer.b_accepted,
            myFavorite: isA ? offer.a_favorite : offer.b_favorite,
            myFeedbackReason: feedbackByPair.get(offer.id) ?? null,
            candidate: await privateCandidate(candidateId, user),
          };
        }))).filter((offer) => offer.candidate != null);
        shortlistRound = {
          id: currentRound.id,
          roundNumber: currentRound.round_number,
          status: currentRound.status,
          responseDeadline: currentRound.response_deadline,
          hasOptions: shortlist.length > 0,
          allResponded: shortlist.length > 0 && shortlist.every((offer) => offer.myAccepted !== null),
          behaviorComplete,
        };
    }

    const { data: draws, error: drawsError } = await supabaseAdmin.from('raffle_draws').select('*')
      .eq('event_key', RAFFLE.key)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .in('status', ['pending', 'both_accepted'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (drawsError) throw drawsError;
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
        winnerSlot: latestDraw.winner_slot,
        restaurant: latestDraw.restaurant,
        happensAt: latestDraw.happens_at,
      };
      other = await privateCandidate(otherId, user);
    }
  } catch (error) {
    console.error('[dating-experiment-status]', error);
    return NextResponse.json({ error: 'Dating Experiment status is temporarily unavailable. Please retry.' }, {
      status: 503,
      headers: { 'Retry-After': '15' },
    });
  }

  const eventCap = event?.entry_cap ?? RAFFLE.cap;
  let spotsLeft = eventCap;
  try {
    const { count, error: countError } = await supabaseAdmin.from('raffle_entries')
      .select('user_id', { count: 'exact', head: true })
      .eq('event_key', RAFFLE.key)
      .eq('terms_version', event?.terms_version ?? RAFFLE.termsVersion)
      .neq('status', 'withdrawn');
    if (countError) throw countError;
    spotsLeft = Math.max(0, eventCap - (count ?? 0));
  } catch (error) {
    console.error('[dating-experiment-capacity]', error);
    return NextResponse.json({ error: 'Dating Experiment status is temporarily unavailable. Please retry.' }, {
      status: 503,
      headers: { 'Retry-After': '15' },
    });
  }

  const outcome = draw?.bothAccepted
    ? { state: 'selected' }
    : shortlist.length
      ? { state: shortlistRound?.allResponded ? 'choices-sealed' : 'shortlisted' }
      : entry?.status === 'passed'
        ? { state: 'not-selected' }
        : entry?.status === 'withdrawn'
          ? { state: 'withdrawn' }
          : entered
            ? { state: shortlistRound && !shortlist.length ? 'round-waiting' : 'waiting' }
            : null;

  return NextResponse.json({
    event: {
      series: event?.public_name ?? RAFFLE.series, city: event?.city ?? RAFFLE.city, dateLabel: datingExperimentDateLabel(event), budget: (event?.prize_per_pair_cents ?? RAFFLE.budget * 100) / 100,
      tagline: RAFFLE.tagline, drawLabel: RAFFLE.drawLabel, shortlistAt: RAFFLE.shortlistAt, cap: eventCap, entryCloseLabel: RAFFLE.entryCloseLabel,
      statusLabel: RAFFLE.statusLabel, entriesOpen, rehearsal,
      radiusMiles: Number(event?.radius_miles ?? RAFFLE.radiusMiles), centerZip: event?.center_zip ?? RAFFLE.centerZip, termsVersion: event?.terms_version ?? RAFFLE.termsVersion,
      videoMinSeconds: RAFFLE.videoMinSeconds, videoMaxSeconds: RAFFLE.videoMaxSeconds, videoMaxBytes: RAFFLE.videoMaxBytes,
      shortlistMaxOptions: event?.shortlist_max_options ?? RAFFLE.shortlistMaxOptions,
      winnerPairCount: event?.winner_pair_limit ?? RAFFLE.winnerPairCount,
      dateOptions: event?.dinner_dates.map((date) => ({
        key: date.slot_key,
        label: date.public_label,
        eventDate: date.event_date,
        dateLabel: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date.event_date}T12:00:00Z`)),
        timeLabel: date.public_label.includes(' · ') ? date.public_label.split(' · ').slice(1).join(' · ') : date.public_label,
      })) ?? RAFFLE.dateOptions,
      spotsLeft, closed: !entriesOpen || spotsLeft === 0,
    },
    eligible,
    hasProfile,
    profileMissing: profileReadiness.missing.map((item) => item.label),
    profileGate: {
      age: typeof user.age === 'number' ? user.age : null,
      interests: profileReadiness.interests,
      requirements: profileReadiness.requirements,
    },
    entered, entry, shortlist, shortlistRound, draw, other, outcome,
  });
}
