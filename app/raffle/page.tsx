import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { RAFFLE, raffleEligible } from '@/lib/raffle';
import { isPro } from '@/lib/pro';
import RaffleClient from './raffle-client';

export const dynamic = 'force-dynamic';

export default async function RafflePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/raffle');

  // "Established cred" — we pull from the real profile so entry isn't one click.
  const interests = (user.hobbies?.length || 0) + (user.music?.length || 0) + (user.food?.length || 0) + (user.sports?.length || 0);
  const profile = {
    photo: !!user.photo_url,
    quiz: !!user.archetype && typeof user.score_honesty === 'number',
    bio: !!(user.bio || '').trim(),
    gender: user.gender || '',
    seeking: user.seeking || '',
    age: user.age ?? null,
    ageMin: user.age_min ?? 22,
    ageMax: user.age_max ?? 38,
    interests,
    archetype: user.archetype || null,
    isPro: isPro(user),
  };

  return (
    <RaffleClient
      firstName={(user.name || 'friend').split(' ')[0]}
      eligible={raffleEligible(user)}
      profile={profile}
      event={{ series: RAFFLE.series, city: RAFFLE.city, dateLabel: RAFFLE.dateLabel, budget: RAFFLE.budget, tagline: RAFFLE.tagline, drawLabel: RAFFLE.drawLabel, entriesOpen: RAFFLE.entriesOpen, statusLabel: RAFFLE.statusLabel } as any}
    />
  );
}
