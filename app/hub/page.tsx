import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { HUB_CONCIERGE_VERSION } from '@/lib/connection-concierge';
import { hasMatchingEmbeddingConsent } from '@/lib/connection-embeddings';
import HubClient from './hub-client';

export const dynamic = 'force-dynamic';

export default async function HubPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

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
    />
  );
}
