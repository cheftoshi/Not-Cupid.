import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { RAFFLE, raffleEligible, raffleClosed, raffleEntriesOpen } from '@/lib/raffle';
import { drawRaffle } from '@/lib/raffle-draw';
import { isManagedStorageUrl } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

const INTENTIONS = new Set(['relationship', 'intentional', 'open']);
const ENERGIES = new Set(['conversation', 'playful', 'foodie']);

// Enter the Dating Experiment. The public flow is intentionally short, while
// the server records each material consent separately for an auditable trail.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.is_test === true) return NextResponse.json({ error: 'Test accounts cannot enter the live Dating Experiment.' }, { status: 403 });
  if (!raffleEntriesOpen()) return NextResponse.json({ error: 'Entries are paused while we finish the public-launch checklist.' }, { status: 403 });
  if (!raffleEligible(user)) return NextResponse.json({ error: `This experiment is for Massachusetts residents within ${RAFFLE.radiusMiles} miles of ${RAFFLE.centerZip}.` }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const video_url = body.video_url ? String(body.video_url).slice(0, 2000) : null;
  const videoDuration = Number(body.videoDurationSeconds);
  const notify = body.notify !== false;
  const intention = INTENTIONS.has(body.intention) ? body.intention : null;
  const energy = ENERGIES.has(body.energy) ? body.energy : null;
  const conversationStarter = String(body.conversationStarter || '').trim().slice(0, 160);

  // Match basics from the form — set them on the real profile (the matcher reads
  // user.gender/seeking/age) so they're not raffle-only.
  const gender = ['m', 'f', 'nb'].includes(body.gender) ? body.gender : null;
  const rawSeeking = ['m', 'f', 'b', 'both'].includes(body.seeking) ? body.seeking : null;
  const seeking = rawSeeking === 'both' ? 'b' : rawSeeking;
  const ageMin = Number(body.ageMin), ageMax = Number(body.ageMax);
  const ageOk = ageMin >= 18 && ageMin <= 99 && ageMax >= ageMin && ageMax <= 99;
  const profilePatch: any = {};
  if (gender) profilePatch.gender = gender;
  if (seeking) profilePatch.seeking = seeking;
  if (ageOk) { profilePatch.age_min = ageMin; profilePatch.age_max = ageMax; }
  if (Object.keys(profilePatch).length) {
    const { error: profileError } = await supabaseAdmin.from('users').update(profilePatch).eq('id', user.id);
    if (profileError) {
      console.error('[dating-experiment-profile]', profileError);
      return NextResponse.json({ error: 'Could not save your match preferences.' }, { status: 500 });
    }
  }

  // "Established cred" gate — pull from the (now-updated) profile.
  const g = gender || user.gender, sk = seeking || user.seeking;
  const interests = (user.hobbies?.length || 0) + (user.music?.length || 0) + (user.food?.length || 0) + (user.sports?.length || 0);
  const missing: string[] = [];
  if (!user.photo_url) missing.push('a profile photo');
  if (!user.archetype || typeof user.score_honesty !== 'number') missing.push('the personality quiz');
  if (!(user.bio || '').trim()) missing.push('a bio');
  if (interests < 3) missing.push('3+ interests');
  if (user.age == null) missing.push('your age');
  if (!g) missing.push('your gender');
  if (!sk) missing.push('who to match you with');
  if (missing.length) return NextResponse.json({ error: `Finish your profile first — still need: ${missing.join(', ')}.` }, { status: 400 });
  if (user.age < 21) return NextResponse.json({ error: 'This dinner is 21 and over — you’re not eligible for this round.' }, { status: 400 });
  if (!video_url) return NextResponse.json({ error: 'Your intro video is required to enter.' }, { status: 400 });
  if (!isManagedStorageUrl(video_url, 'raffle-videos', `${user.id}/${RAFFLE.key}-`)) {
    return NextResponse.json({ error: 'Upload your intro video through NotCupid before entering.' }, { status: 400 });
  }
  if (!Number.isFinite(videoDuration) || videoDuration < RAFFLE.videoMinSeconds || videoDuration > RAFFLE.videoMaxSeconds) {
    return NextResponse.json({ error: `Your intro video must be ${RAFFLE.videoMinSeconds}–${RAFFLE.videoMaxSeconds} seconds long.` }, { status: 400 });
  }
  if (!intention || !energy || conversationStarter.length < 3) {
    return NextResponse.json({ error: 'Finish the three short experiment questions before entering.' }, { status: 400 });
  }
  if (body.termsVersion !== RAFFLE.termsVersion || body.termsAccepted !== true) {
    return NextResponse.json({ error: 'Please agree to the current Dating Experiment Terms.' }, { status: 400 });
  }
  if (body.videoConsent !== true) return NextResponse.json({ error: 'Please consent to the private profile and video preview.' }, { status: 400 });
  if (body.safetyAcknowledged !== true) return NextResponse.json({ error: 'Please acknowledge the participant safety notice.' }, { status: 400 });
  if (body.attendanceConfirmed !== true) return NextResponse.json({ error: 'Please confirm you can attend the stated dinner.' }, { status: 400 });

  // New entrants face the deadline and overall cap. Compatibility graph health,
  // rather than a binary gender quota, determines whether a pair can be formed.
  const { data: mine } = await supabaseAdmin.from('raffle_entries').select('user_id, status').eq('user_id', user.id).eq('event_key', RAFFLE.key).maybeSingle();
  const alreadyIn = !!mine && mine.status !== 'withdrawn';
  if (!alreadyIn) {
    if (raffleClosed()) return NextResponse.json({ error: 'Entries are closed for this one — watch the hub for the next.' }, { status: 400 });
    const { data: ents } = await supabaseAdmin.from('raffle_entries').select('user_id').eq('event_key', RAFFLE.key).neq('status', 'withdrawn');
    const ids = (ents ?? []).map((e: any) => e.user_id);
    if (ids.length >= RAFFLE.cap) return NextResponse.json({ error: 'This Dating Experiment round just hit capacity — watch the hub for the next one.' }, { status: 400 });
  }

  const acceptedAt = new Date().toISOString();
  const row: any = {
    user_id: user.id,
    event_key: RAFFLE.key,
    video_url,
    video_duration_seconds: videoDuration,
    notify,
    status: 'entered',
    agreed_at: acceptedAt,
    terms_version: RAFFLE.termsVersion,
    terms_accepted_at: acceptedAt,
    video_consent_at: acceptedAt,
    safety_acknowledged_at: acceptedAt,
    attendance_confirmed_at: acceptedAt,
    // Publicity/marketing permission must use a future, separate consent flow;
    // this entry endpoint never infers or accepts it.
    publicity_consent_at: null,
    questionnaire: { intention, energy, conversationStarter },
    withdrawn_at: null,
  };
  const { error } = await supabaseAdmin.from('raffle_entries').upsert(row, { onConflict: 'user_id,event_key' });
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
