import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { HUB_CONCIERGE_VERSION } from '@/lib/connection-concierge';
import { hasMatchingEmbeddingConsent } from '@/lib/connection-embeddings';
import { hasCrossIntentBridgeConsent } from '@/lib/matching-rollouts';
import HubClient from './hub-client';
import PlansHome from './plans-home';
import { friendLocationContext, friendMetroLabel } from '@/lib/friend-location';
import { initialPlanFilter } from '@/lib/connection-plans';

export const dynamic = 'force-dynamic';

export default async function HubPage({ searchParams }: { searchParams: Promise<{ view?: string; plan?: string; date?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  if (!user) redirect(`/login?next=${encodeURIComponent(params.date ? `/hub?date=${params.date}` : params.plan ? `/hub?plan=${params.plan}` : params.view === 'coach' ? '/hub?view=coach' : '/hub')}`);

  if (params.view !== 'coach') {
    const location = await friendLocationContext(user);
    // Setup completion is a default filter, not permission to enroll someone
    // in another line or infer romantic interest from a friendship action.
    return <PlansHome firstName={(user.name || 'friend').split(' ')[0]} city={friendMetroLabel(location.metro)} initialFilter={initialPlanFilter(user)} />;
  }

  const firstName = (user.name || 'friend').split(' ')[0];
  const metro = metroOf(user.zip);
  const city = metro && METRO_CENTERS[metro]
    ? `${METRO_CENTERS[metro].city}, ${METRO_CENTERS[metro].state}`
    : null;
  const conciergeConsented = user.ai_concierge_consent_version === HUB_CONCIERGE_VERSION
    && !!user.ai_concierge_consent_at
    && !user.ai_concierge_consent_revoked_at;

  return (
    <HubClient
      firstName={firstName}
      city={city}
      conciergeConsented={conciergeConsented}
      matchingPersonalizationEnabled={hasMatchingEmbeddingConsent(user)}
      crossIntentBridgeEnabled={hasCrossIntentBridgeConsent(user)}
    />
  );
}
