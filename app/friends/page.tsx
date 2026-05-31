import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasFriendVibes } from '@/lib/friend-quiz';
import FriendHubClient from './friend-hub-client';

export const dynamic = 'force-dynamic';

export default async function FriendsHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/friends');
  // Not onboarded into Friend Maxxin yet → take the find-a-friend quiz first.
  if (!user.friend_opted_in_at || !hasFriendVibes(user.friend_vibes)) redirect('/friends/quiz');
  return <FriendHubClient firstName={(user.name || 'friend').split(' ')[0]} />;
}
