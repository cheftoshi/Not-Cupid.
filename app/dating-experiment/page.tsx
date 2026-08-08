import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { RAFFLE, raffleEligible, raffleEntriesOpen } from '@/lib/raffle';
import DatingExperimentClient from '@/app/raffle/raffle-client';

export const dynamic = 'force-dynamic';

export default async function DatingExperimentPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dating-experiment');

  const interests = (user.hobbies?.length || 0) + (user.music?.length || 0) + (user.food?.length || 0) + (user.sports?.length || 0);
  const profile = {
    photo: !!user.photo_url,
    quiz: !!user.archetype && typeof user.score_honesty === 'number',
    bio: !!(user.bio || '').trim(),
    gender: user.gender || '',
    seeking: user.seeking === 'both' ? 'b' : (user.seeking || ''),
    age: user.age ?? null,
    ageMin: user.age_min ?? 22,
    ageMax: user.age_max ?? 38,
    interests,
    archetype: user.archetype || null,
  };

  return (
    <DatingExperimentClient
      firstName={(user.name || 'friend').split(' ')[0]}
      eligible={user.is_test !== true && raffleEligible(user)}
      profile={profile}
      event={{
        series: RAFFLE.series,
        city: RAFFLE.city,
        dateLabel: RAFFLE.dateLabel,
        budget: RAFFLE.budget,
        tagline: RAFFLE.tagline,
        drawLabel: RAFFLE.drawLabel,
        radiusMiles: RAFFLE.radiusMiles,
        centerZip: RAFFLE.centerZip,
        termsVersion: RAFFLE.termsVersion,
        videoMinSeconds: RAFFLE.videoMinSeconds,
        videoMaxSeconds: RAFFLE.videoMaxSeconds,
        videoMaxBytes: RAFFLE.videoMaxBytes,
        shortlistMaxOptions: RAFFLE.shortlistMaxOptions,
        winnerPairCount: RAFFLE.winnerPairCount,
        entriesOpen: raffleEntriesOpen(),
        statusLabel: RAFFLE.statusLabel,
      }}
    />
  );
}
