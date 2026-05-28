import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import HubClient from './hub-client';

export const dynamic = 'force-dynamic';

export default async function HubPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const firstName = (user.name || 'friend').split(' ')[0];
  const onWaitlist = !!user.friend_waitlist_at;
  return <HubClient firstName={firstName} onWaitlist={onWaitlist} hasArchetype={!!user.archetype} />;
}
