import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasFriendVibes } from '@/lib/friend-quiz';
import FriendProfileClient from './friend-profile-client';

export const dynamic = 'force-dynamic';

export default async function FriendProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/friends/profile');
  if (!user.friend_opted_in_at || !hasFriendVibes(user.friend_vibes)) redirect('/friends/quiz');

  return (
    <FriendProfileClient
      initial={{
        name: user.name || '',
        photo_url: user.photo_url || null,
        gallery: Array.isArray(user.gallery) ? user.gallery : [],
        bio: user.bio || '',
        occupation: user.occupation || '',
        music: user.music || [],
        food: user.food || [],
        hobbies: user.hobbies || [],
      }}
      refreshCount={user.profile_refresh_count ?? 0}
    />
  );
}
