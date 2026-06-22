import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import HubClient from './hub-client';

export const dynamic = 'force-dynamic';

export default async function HubPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const firstName = (user.name || 'friend').split(' ')[0];
  const onWaitlist = !!user.friend_waitlist_at;
  // The user's metro — we now span all of New England + NYC, so show where they are.
  const metro = metroOf(user.zip);
  const city = metro && METRO_CENTERS[metro] ? `${METRO_CENTERS[metro].city}, ${METRO_CENTERS[metro].state}` : null;
  // Boarding Love runs the deeper romantic quiz (partner + attachment + values)
  // once. Done = they have an attachment style on file.
  const needsLoveDeep = !!user.archetype && !user.attach_style;

  // The hub is the user's home base — pass their own display fields so it can
  // show their photo, archetype, personality + vibes (NOT email/tokens/etc).
  const profile = {
    name: user.name || 'friend',
    photo_url: user.photo_url ?? null,
    archetype: user.archetype ?? null,
    age: user.age ?? null,
    score_honesty: user.score_honesty,
    score_emotionality: user.score_emotionality,
    score_extraversion: user.score_extraversion,
    score_agreeableness: user.score_agreeableness,
    score_conscientiousness: user.score_conscientiousness,
    score_openness: user.score_openness,
    attach_style: user.attach_style ?? null,
    vibes: user.vibes ?? null,
    sun_sign: user.sun_sign ?? null,
    music: user.music ?? [],
    food: user.food ?? [],
    hobbies: user.hobbies ?? [],
  };

  return <HubClient firstName={firstName} onWaitlist={onWaitlist} hasArchetype={!!user.archetype} needsLoveDeep={needsLoveDeep} profile={profile} city={city} currentMetro={metro} matchRadius={user.match_radius ?? 15} />;
}
