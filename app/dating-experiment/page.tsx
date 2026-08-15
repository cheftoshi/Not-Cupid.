import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { RAFFLE, raffleEligible } from '@/lib/raffle';
import DatingExperimentClient from '@/app/raffle/raffle-client';
import { experimentGendersFromLegacy } from '@/lib/experiment-preferences';
import {
  datingExperimentDateLabel,
  datingExperimentEntriesOpen,
  getDatingExperimentEvent,
} from '@/lib/dating-experiment-event';

export const dynamic = 'force-dynamic';

export default async function DatingExperimentPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dating-experiment');
  const experiment = await getDatingExperimentEvent();
  const eventLocation = experiment
    ? { centerZip: experiment.center_zip, radiusMiles: Number(experiment.radius_miles) }
    : RAFFLE;

  const interests = (user.hobbies?.length || 0) + (user.music?.length || 0) + (user.food?.length || 0) + (user.sports?.length || 0);
  const profile = {
    photo: !!user.photo_url,
    quiz: !!user.archetype && typeof user.score_honesty === 'number',
    bio: !!(user.bio || '').trim(),
    gender: user.gender || '',
    seekingGenders: experimentGendersFromLegacy(user.seeking),
    age: user.age ?? null,
    ageMin: user.age_min ?? 22,
    ageMax: user.age_max ?? 38,
    interests,
    archetype: user.archetype || null,
  };

  return (
    <DatingExperimentClient
      firstName={(user.name || 'friend').split(' ')[0]}
      eligible={user.is_test !== true && raffleEligible(user, eventLocation)}
      profile={profile}
      event={{
        series: experiment?.public_name ?? RAFFLE.series,
        city: experiment?.city ?? RAFFLE.city,
        dateLabel: datingExperimentDateLabel(experiment),
        dateOptions: experiment?.dinner_dates.map((slot) => ({
          key: slot.slot_key,
          label: slot.public_label,
          eventDate: slot.event_date,
          dateLabel: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${slot.event_date}T12:00:00Z`)),
          timeLabel: slot.public_label.includes(' · ') ? slot.public_label.split(' · ').slice(1).join(' · ') : slot.public_label,
        })) ?? RAFFLE.dateOptions,
        budget: (experiment?.prize_per_pair_cents ?? RAFFLE.budget * 100) / 100,
        tagline: RAFFLE.tagline,
        drawLabel: RAFFLE.drawLabel,
        radiusMiles: Number(experiment?.radius_miles ?? RAFFLE.radiusMiles),
        centerZip: experiment?.center_zip ?? RAFFLE.centerZip,
        termsVersion: experiment?.terms_version ?? RAFFLE.termsVersion,
        videoMinSeconds: RAFFLE.videoMinSeconds,
        videoMaxSeconds: RAFFLE.videoMaxSeconds,
        videoMaxBytes: RAFFLE.videoMaxBytes,
        shortlistMaxOptions: experiment?.shortlist_max_options ?? RAFFLE.shortlistMaxOptions,
        winnerPairCount: experiment?.winner_pair_limit ?? RAFFLE.winnerPairCount,
        entriesOpen: datingExperimentEntriesOpen(experiment),
        statusLabel: RAFFLE.statusLabel,
      }}
    />
  );
}
