import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import MatchReveal from './match-reveal';
import ActiveChats from './active-chats';
import RosterPicker from './roster-picker';
import LocationControls from '@/components/location-controls';
import { zipDistanceMiles, DEFAULT_MATCH_RADIUS, MAX_MATCH_RADIUS, metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { recordUnlock } from '@/lib/record-unlock';
import { isPro } from '@/lib/pro';
import { liveMatchesFor, releaseTimedOutMatches, MAX_CONNECTIONS } from '@/lib/match-actions';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { unlock_session?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (!user.archetype) redirect('/quiz');

  // If returning from Stripe checkout, verify the payment inline
  if (searchParams.unlock_session) {
    try {
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${searchParams.unlock_session}`,
        { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, cache: 'no-store' }
      );
      const session = await stripeRes.json();
      if (
        session.payment_status === 'paid' &&
        session.metadata?.user_id === user.id &&
        session.metadata?.type === 'match_unlock'
      ) {
        await recordUnlock({
          userId: user.id,
          matchId: session.metadata.match_id,
          unlockedUserId: session.metadata.unlocked_user_id,
          tier: session.metadata.unlock_tier === 'hexaco' ? 'hexaco' : 'profile',
          paymentId: session.payment_intent,
        });
      }
    } catch (e) {
      console.error('Unlock verification failed:', e);
    }
  }

  // Capacity model: a user can run up to MAX_CONNECTIONS live conversations at
  // once. Sweep any timed-out matches, then load ALL live matches as a list of
  // "connections" (each gets its own card), plus the roster to discover more.
  await releaseTimedOutMatches(user.id);
  // History is independent of the live set — fetch them in parallel (the
  // dashboard was a 6-query sequential waterfall).
  const [liveMatches, { data: historyMatches }] = await Promise.all([
    liveMatchesFor(user.id),
    supabaseAdmin
      .from('matches')
      .select('id, user_1_id, user_2_id, ended_at')
      .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(10),
  ]);
  liveMatches.sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const liveIds = liveMatches.map((m: any) => m.id);
  const otherIds = liveMatches.map((m: any) => (m.user_1_id === user.id ? m.user_2_id : m.user_1_id));
  const historyOtherIds = Array.from(new Set(
    (historyMatches ?? []).map((m: any) => (m.user_1_id === user.id ? m.user_2_id : m.user_1_id))
  ));
  // MatchCard needs profile + HEXACO fields — but not email/roster_snapshot/etc.
  const CARD_COLS =
    'id, name, age, photo_url, archetype, occupation, zip, relationship_style, sun_sign, bio, gallery, music, food, hobbies, ' +
    'score_honesty, score_emotionality, score_extraversion, score_agreeableness, score_conscientiousness, score_openness, is_test';
  const [{ data: unlockRows }, { data: others }, { data: historyOthers }] = await Promise.all([
    liveIds.length
      ? supabaseAdmin
          .from('match_unlocks')
          .select('match_id, hexaco_unlocked, profile_unlocked')
          .eq('user_id', user.id)
          .in('match_id', liveIds)
      : Promise.resolve({ data: [] as any[] }),
    otherIds.length
      ? supabaseAdmin.from('users').select(CARD_COLS).in('id', otherIds)
      : Promise.resolve({ data: [] as any[] }),
    historyOtherIds.length
      ? supabaseAdmin.from('users').select('id, name').in('id', historyOtherIds)
      : Promise.resolve({ data: [] as any[] }),
  ] as any[]);
  const unlockByMatch = new Map<string, any>((unlockRows ?? []).map((u: any) => [u.match_id, u]));
  const otherById = new Map<string, any>((others ?? []).map((u: any) => [u.id, u]));
  const historyNameById = new Map<string, any>((historyOthers ?? []).map((u: any) => [u.id, u.name]));

  const isTestViewer = (user as any).is_test === true;
  // All-Access subscribers see every match's full profile, no per-unlock fee.
  const viewerIsPro = isPro(user);
  const connections = liveMatches
    .map((m: any) => {
      const otherId = m.user_1_id === user.id ? m.user_2_id : m.user_1_id;
      const other = otherById.get(otherId);
      if (!other) return null;
      // Realm segregation: real users never see test matches & vice versa.
      if (((other as any).is_test === true) !== isTestViewer) return null;
      const u: any = unlockByMatch.get(m.id);
      const profileUnlocked = !!u?.profile_unlocked || viewerIsPro;
      const hexacoUnlocked = !!u?.hexaco_unlocked || profileUnlocked;
      const d = zipDistanceMiles(user.zip, other.zip);
      return {
        match: m,
        otherUser: other,
        profileUnlocked,
        hexacoUnlocked,
        isUnlocked: profileUnlocked,
        distanceMi: d == null ? null : Math.round(d),
        beyondRadius: d != null && d > (user.match_radius ?? DEFAULT_MATCH_RADIUS),
      };
    })
    .filter(Boolean) as any[];

  const newest = connections[0] || null;
  // Only run the cinematic for a GENUINELY new match (created in the last ~12
  // min). localStorage already plays it once per match, but a blocked/evicted
  // localStorage write (Safari) would otherwise re-fire it on every visit — this
  // hard-stops an existing chat (e.g. one you've been talking in) from re-playing.
  const newestFresh = !!newest?.match?.created_at &&
    Date.now() - new Date(newest.match.created_at).getTime() < 12 * 60 * 1000;

  // Location (dates): the city + radius controls live HERE, not on the hub.
  const dashMetro = metroOf(user.zip);
  const dashCity = dashMetro && METRO_CENTERS[dashMetro] ? `${METRO_CENTERS[dashMetro].city}, ${METRO_CENTERS[dashMetro].state}` : null;

  // Your chosen/active matches → the rich cards at the TOP of the dashboard.
  const cityLabel = (zip: string | null | undefined): string | null => {
    const mt = metroOf(zip);
    return mt && METRO_CENTERS[mt] ? `${METRO_CENTERS[mt].city}, ${METRO_CENTERS[mt].state}` : null;
  };
  const activeCards = connections.map((c: any) => {
    const m = c.match;
    const isU1 = m.user_1_id === user.id;
    const myAcc = isU1 ? m.user_1_accepted : m.user_2_accepted;
    const both = m.user_1_accepted && m.user_2_accepted;
    const o = c.otherUser;
    const hasContent = !!(o.bio || '').trim() || (Array.isArray(o.gallery) && o.gallery.length > 0);
    // Interests (music/food/hobbies) + bio are part of the $0.99 unlock — only
    // surface them once the profile is unlocked; the rest (archetype, career,
    // city, style, sign) is free.
    const interests = c.profileUnlocked
      ? [...(o.music || []), ...(o.food || []), ...(o.hobbies || [])].filter(Boolean).slice(0, 5)
      : [];
    return {
      matchId: m.id, name: o.name || 'your match', photo_url: o.photo_url || null,
      age: o.age ?? null, archetype: o.archetype || null, occupation: o.occupation || null,
      city: cityLabel(o.zip), relationship_style: o.relationship_style || null, sun_sign: o.sun_sign || null,
      score: m.compatibility_score ?? null,
      bio: c.profileUnlocked ? (o.bio || null) : null, interests,
      status: (both ? 'chatting' : myAcc ? 'waiting' : 'your-move') as 'chatting' | 'waiting' | 'your-move',
      profileUnlocked: c.profileUnlocked, hasContent,
    };
  });

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <h1 className={styles.title}>
          your <span className={styles.titleAccent}>matches.</span>
        </h1>
        <p className={styles.subtitle}>
          {connections.length > 0
            ? `up to ${MAX_CONNECTIONS} conversations at once · you set the pace →`
            : 'pick who you connect with · you set the pace →'}
        </p>

        {/* dates: change your city + match radius (was on the hub) */}
        <div style={{ marginBottom: '2.5rem' }}>
          <LocationControls city={dashCity} currentMetro={dashMetro} radius={user.match_radius ?? DEFAULT_MATCH_RADIUS} showRadius />
        </div>

        {/* One-time cinematic reveal — only for a genuinely fresh match. */}
        {newest && newestFresh && (
          <MatchReveal
            matchId={newest.match.id}
            name={newest.otherUser.name || 'your match'}
            score={newest.match.compatibility_score ?? null}
            archetype={newest.otherUser.archetype}
          />
        )}

        {/* STACKED: your active chats on TOP (rich, full-width), then the people
            to pick from BELOW as a horizontal row. */}
        {activeCards.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <ActiveChats cards={activeCards} />
          </div>
        )}
        <RosterPicker
          radius={user.match_radius ?? DEFAULT_MATCH_RADIUS}
          maxRadius={MAX_MATCH_RADIUS}
          maxConnections={MAX_CONNECTIONS}
          horizontal
          hasActive={activeCards.length > 0}
          liveConnections={connections.map((c: any) => ({
            matchId: c.match.id,
            name: c.otherUser.name || 'your match',
          }))}
        />

        {historyMatches && historyMatches.length > 0 && (
          <div className={styles.history}>
            <h2 className={styles.historyTitle}>past conversations</h2>
            <div className={styles.historyList}>
              {historyMatches.map((m: any) => {
                const otherId = m.user_1_id === user.id ? m.user_2_id : m.user_1_id;
                const name = historyNameById.get(otherId) || 'a match';
                return (
                  <a key={m.id} href={`/match/${m.id}`} className={styles.historyItem} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                    <span className={styles.historyDate}>
                      {new Date(m.ended_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={styles.historyOutcome}>{name} <span style={{ opacity: 0.5 }}>· read →</span></span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
