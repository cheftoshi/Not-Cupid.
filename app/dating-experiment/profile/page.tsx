import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { experimentProfileReadiness } from '@/lib/experiment-profile';
import ExperimentProfileCompletion from './experiment-profile-completion';

export const dynamic = 'force-dynamic';

export default async function DatingExperimentProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dating-experiment/profile');

  const readiness = experimentProfileReadiness(user);
  if (readiness.complete) redirect('/dating-experiment?from=profile-ready');

  return (
    <ExperimentProfileCompletion
      initialProfile={{
        age: user.age ?? null,
        photo_url: user.photo_url || null,
        archetype: user.archetype || null,
        score_honesty: typeof user.score_honesty === 'number' ? user.score_honesty : null,
        bio: user.bio || '',
        hobbies: Array.isArray(user.hobbies) ? user.hobbies : [],
        music: Array.isArray(user.music) ? user.music : [],
        food: Array.isArray(user.food) ? user.food : [],
        sports: Array.isArray(user.sports) ? user.sports : [],
      }}
    />
  );
}
