import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleEligible } from '@/lib/raffle';
import { drawRaffle } from '@/lib/raffle-draw';
import { isManagedStorageUrl } from '@/lib/request-security';
import { datingExperimentAdminRehearsalOpen, datingExperimentEntriesOpen, getDatingExperimentEvent } from '@/lib/dating-experiment-event';
import {
  experimentGendersFromLegacy,
  normalizeExperimentGenders,
  normalizeExperimentOrientation,
} from '@/lib/experiment-preferences';

export const dynamic = 'force-dynamic';

const INTENTIONS = new Set(['relationship', 'intentional', 'open']);
const ENERGIES = new Set(['conversation', 'playful', 'foodie']);
const PLANNING_STYLES = new Set(['planned', 'spontaneous', 'flexible']);

// Enter the Dating Experiment. The public flow is intentionally short, while
// the server records each material consent separately for an auditable trail.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.is_test === true) return NextResponse.json({ error: 'Test accounts cannot enter the live Dating Experiment.' }, { status: 403 });
  const event = await getDatingExperimentEvent();
  const entriesOpen = datingExperimentEntriesOpen(event) || datingExperimentAdminRehearsalOpen(event, user);
  if (!entriesOpen) return NextResponse.json({ error: 'Dating Experiment entries are not currently open.' }, { status: 403 });
  const eventLocation = { centerZip: event!.center_zip, radiusMiles: Number(event!.radius_miles) };
  if (!raffleEligible(user, eventLocation)) return NextResponse.json({ error: `This experiment is for Massachusetts residents within ${eventLocation.radiusMiles} miles of ${eventLocation.centerZip}.` }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const video_url = body.video_url ? String(body.video_url).slice(0, 2000) : null;
  const videoDuration = body.videoDurationSeconds == null ? null : Number(body.videoDurationSeconds);
  const notify = body.notify !== false;
  const intention = INTENTIONS.has(body.intention) ? body.intention : null;
  const energy = ENERGIES.has(body.energy) ? body.energy : null;
  const planningStyle = PLANNING_STYLES.has(body.planningStyle) ? body.planningStyle : null;
  const conversationStarter = String(body.conversationStarter || '').trim().slice(0, 160);

  // Match basics are validated server-side and frozen into this experiment
  // entry. This supports any one-or-more combination of men, women, and
  // non-binary / another identity without broadening the user's Love profile.
  const gender = ['m', 'f', 'nb'].includes(body.gender) ? body.gender : null;
  const orientation = normalizeExperimentOrientation(body.orientation);
  const rawSeeking = ['m', 'f', 'b', 'both'].includes(body.seeking) ? body.seeking : null;
  const seekingGenders = Array.isArray(body.seekingGenders)
    ? normalizeExperimentGenders(body.seekingGenders)
    : experimentGendersFromLegacy(rawSeeking);
  const ageMin = Number(body.ageMin), ageMax = Number(body.ageMax);
  const eventSlotKeys = new Set(event!.dinner_dates.map((slot) => slot.slot_key));
  const availableSlotKeys = Array.isArray(body.availableSlotKeys)
    ? [...new Set(body.availableSlotKeys.map((value: unknown) => String(value)).filter((value: string) => eventSlotKeys.has(value)))]
    : [];
  const ageOk = Number.isInteger(ageMin) && Number.isInteger(ageMax)
    && ageMin >= 21 && ageMin <= 99 && ageMax >= ageMin && ageMax <= 99;
  if (!gender) return NextResponse.json({ error: 'Choose how you identify for this experiment.' }, { status: 400 });
  if (!orientation) return NextResponse.json({ error: 'Choose the orientation label that feels closest to you.' }, { status: 400 });
  if (!seekingGenders.length) return NextResponse.json({ error: 'Choose at least one gender you would like to meet.' }, { status: 400 });
  if (!ageOk) return NextResponse.json({ error: 'Choose a valid age range between 21 and 99.' }, { status: 400 });
  if (!availableSlotKeys.length) return NextResponse.json({ error: 'Choose at least one dinner time you can attend.' }, { status: 400 });

  // These choices are experiment-specific. Do not silently widen or otherwise
  // mutate the user's general Love Line preferences.

  // "Established cred" gate — pull identity signals from the existing profile.
  const interests = (user.hobbies?.length || 0) + (user.music?.length || 0) + (user.food?.length || 0) + (user.sports?.length || 0);
  const missing: string[] = [];
  if (!user.photo_url) missing.push('a profile photo');
  if (!user.archetype || typeof user.score_honesty !== 'number') missing.push('the personality quiz');
  if (!(user.bio || '').trim()) missing.push('a bio');
  if (interests < 3) missing.push('3+ interests');
  if (user.age == null) missing.push('your age');
  if (missing.length) return NextResponse.json({ error: `Finish your profile first — still need: ${missing.join(', ')}.` }, { status: 400 });
  if (user.age < 21) return NextResponse.json({ error: 'This dinner is 21 and over — you’re not eligible for this round.' }, { status: 400 });
  if (video_url && !isManagedStorageUrl(video_url, 'raffle-videos', `${user.id}/${RAFFLE.key}-`)) {
    return NextResponse.json({ error: 'Upload your intro video through NotCupid before entering.' }, { status: 400 });
  }
  if (video_url && (!Number.isFinite(videoDuration) || videoDuration! < RAFFLE.videoMinSeconds || videoDuration! > RAFFLE.videoMaxSeconds)) {
    return NextResponse.json({ error: `Your intro video must be ${RAFFLE.videoMinSeconds}–${RAFFLE.videoMaxSeconds} seconds long.` }, { status: 400 });
  }
  if (!video_url && videoDuration != null) return NextResponse.json({ error: 'Upload your intro video through NotCupid before adding its duration.' }, { status: 400 });
  if (!intention || !energy || !planningStyle || conversationStarter.length < 3) {
    return NextResponse.json({ error: 'Finish the short experiment questionnaire before entering.' }, { status: 400 });
  }
  if (body.termsVersion !== event!.terms_version || body.termsAccepted !== true) {
    return NextResponse.json({ error: 'Please agree to the current Dating Experiment Terms.' }, { status: 400 });
  }
  if (body.previewConsent !== true) return NextResponse.json({ error: 'Please consent to the private shortlist preview.' }, { status: 400 });
  if (body.safetyAcknowledged !== true) return NextResponse.json({ error: 'Please acknowledge the participant safety notice.' }, { status: 400 });
  if (body.attendanceConfirmed !== true) return NextResponse.json({ error: 'Please confirm you can attend at least one listed dinner date.' }, { status: 400 });

  const acceptedAt = new Date().toISOString();
  // Capacity reservation and the entry write happen under one event-row lock.
  // This keeps simultaneous signups from oversubscribing a limited event.
  const { data: reservationRows, error: reservationError } = await supabaseAdmin.rpc(
    'reserve_dating_experiment_entry',
    {
      p_event_key: RAFFLE.key,
      p_user_id: user.id,
      p_video_url: video_url,
      p_video_duration_seconds: videoDuration,
      p_notify: notify,
      p_terms_version: event!.terms_version,
      p_questionnaire: {
        intention,
        energy,
        planningStyle,
        conversationStarter,
        availableSlotKeys,
        preferences: { gender, orientation, seekingGenders, ageMin, ageMax },
      },
      p_accepted_at: acceptedAt,
    },
  );
  if (reservationError) {
    const message = reservationError.message || '';
    if (message.includes('capacity reached')) {
      return NextResponse.json({ error: 'This Dating Experiment round just hit capacity — watch the hub for the next one.' }, { status: 409 });
    }
    if (message.includes('entries are not open')) {
      return NextResponse.json({ error: 'Entries are closed for this one — watch the hub for the next.' }, { status: 403 });
    }
    if (message.includes('terms version') || message.includes('already been processed')) {
      return NextResponse.json({ error: 'This experiment entry needs to be reviewed again before it can be submitted.' }, { status: 409 });
    }
    console.error('dating experiment reservation error', reservationError);
    return NextResponse.json({ error: 'Could not enter — try again.' }, { status: 500 });
  }
  const reservation = Array.isArray(reservationRows) ? reservationRows[0] : reservationRows;

  // Publicity/marketing permission remains outside this RPC and requires a
  // future, separate consent flow. Entry never infers or accepts it.

  // Hit the cap on a new reservation → auto-start the shortlist machinery.
  if (reservation?.was_new && Number(reservation.spots_left) === 0) {
    await drawRaffle().catch((error) => console.error('cap auto-draw failed', error));
  }
  return NextResponse.json({
    ok: true,
    eventKey: RAFFLE.key,
    spotsLeft: Number(reservation?.spots_left ?? 0),
  });
}
