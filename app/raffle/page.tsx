import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { RAFFLE, raffleEligible } from '@/lib/raffle';
import RaffleClient from './raffle-client';

export const dynamic = 'force-dynamic';

export default async function RafflePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/raffle');
  return (
    <RaffleClient
      firstName={(user.name || 'friend').split(' ')[0]}
      eligible={raffleEligible(user)}
      hasProfile={!!user.photo_url && !!user.archetype}
      event={{ series: RAFFLE.series, city: RAFFLE.city, dateLabel: RAFFLE.dateLabel, budget: RAFFLE.budget, tagline: RAFFLE.tagline, drawLabel: RAFFLE.drawLabel }}
    />
  );
}
