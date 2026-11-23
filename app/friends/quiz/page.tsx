import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasFriendVibes } from '@/lib/friend-quiz';
import { friendPlanSelection, friendPlanCoreQuiz, friendPlanDestination, friendPlanLogin } from '@/lib/friend-plan-resume';
import FriendQuizClient from './friend-quiz-client';

export const dynamic = 'force-dynamic';

export default async function FriendQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ retake?: string; friendPlan?: string | string[]; from?: string | string[] }>;
}) {
  const { retake, friendPlan, from } = await searchParams;
  const selectedPlan = friendPlanSelection(friendPlan, from);
  const user = await getCurrentUser();
  if (!user) redirect(selectedPlan ? friendPlanLogin(selectedPlan) : '/login?next=/friends/quiz');
  // Friend matching reuses HEXACO — a brand-new user needs the main quiz first.
  if (typeof user.score_honesty !== 'number') redirect(selectedPlan ? friendPlanCoreQuiz(selectedPlan, { retake: true }) : '/quiz?next=friends');
  // Already onboarded → straight to the hub, UNLESS they're explicitly retaking
  // (?retake=1) — re-running the quiz just re-saves their friend vibes/seeking.
  const isRetake = retake === '1';
  if (!isRetake && user.friend_opted_in_at && hasFriendVibes(user.friend_vibes)) redirect(selectedPlan ? friendPlanDestination(selectedPlan) : '/friends');
  return <FriendQuizClient destination={selectedPlan ? friendPlanDestination(selectedPlan) : '/friends'} resumeLogin={selectedPlan ? friendPlanLogin(selectedPlan) : undefined} />;
}
