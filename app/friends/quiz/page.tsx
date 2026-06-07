import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasFriendVibes } from '@/lib/friend-quiz';
import FriendQuizClient from './friend-quiz-client';

export const dynamic = 'force-dynamic';

export default async function FriendQuizPage({
  searchParams,
}: {
  searchParams: { retake?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/friends/quiz');
  // Friend matching reuses HEXACO — a brand-new user needs the main quiz first.
  if (typeof user.score_honesty !== 'number') redirect('/quiz?next=friends');
  // Already onboarded → straight to the hub, UNLESS they're explicitly retaking
  // (?retake=1) — re-running the quiz just re-saves their friend vibes/seeking.
  const isRetake = searchParams?.retake === '1';
  if (!isRetake && user.friend_opted_in_at && hasFriendVibes(user.friend_vibes)) redirect('/friends');
  return <FriendQuizClient />;
}
