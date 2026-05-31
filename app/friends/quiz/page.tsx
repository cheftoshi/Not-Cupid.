import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasFriendVibes } from '@/lib/friend-quiz';
import FriendQuizClient from './friend-quiz-client';

export const dynamic = 'force-dynamic';

export default async function FriendQuizPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/friends/quiz');
  // Friend matching reuses HEXACO — a brand-new user needs the main quiz first.
  if (typeof user.score_honesty !== 'number') redirect('/quiz?next=friends');
  // Already onboarded → straight to the hub.
  if (user.friend_opted_in_at && hasFriendVibes(user.friend_vibes)) redirect('/friends');
  return <FriendQuizClient />;
}
