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
  const yourMoveCount = activeCards.filter((card) => card.status === 'your-move').length;
  const chattingCount = activeCards.filter((card) => card.status === 'chatting').length;
  const waitingCount = activeCards.filter((card) => card.status === 'waiting').length;
  const nextCard = activeCards.find((card) => card.status === 'your-move') || activeCards.find((card) => card.status === 'chatting') || null;
  const nextTitle = yourMoveCount > 0
    ? `${yourMoveCount} ${yourMoveCount === 1 ? 'person is' : 'people are'} waiting for your hello.`
    : chattingCount > 0
      ? 'keep one conversation warm today.'
      : 'choose someone from your roster.';
  const nextBody = yourMoveCount > 0
    ? 'A small opener beats a perfect one. Pick the person you are most curious about and make it easy to answer.'
    : chattingCount > 0
      ? 'The app works best when a match becomes a rhythm. Reply, suggest a window, or ask the thing you actually want to know.'
      : 'You can keep up to two live connections. Start with the profile that gives you a real reason to say yes.';

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <style>{`
          .dashGrid { display: grid; grid-template-columns: minmax(0,1fr) 286px; gap: 2.6rem; align-items: start; }
          .dashAside { position: sticky; top: 84px; }
          @media (max-width: 900px) { .dashGrid { grid-template-columns: 1fr; gap: 2rem; } .dashAside { position: static; } }
        `}</style>
        <div className="dashGrid">
        <div style={{ minWidth: 0 }}>

        <div className={styles.head}>
          <div className={styles.eyebrow}><span>💘</span> the love line</div>
          <h1 className={styles.title}>
            your <span className={styles.titleAccent}>matches.</span>
          </h1>
          <p className={styles.subtitle}>
            {connections.length > 0
              ? `${activeCards.length} ${activeCards.length === 1 ? 'conversation' : 'conversations'} going · up to ${MAX_CONNECTIONS} at once · you set the pace`
              : 'pick who you connect with · you set the pace'}
          </p>
        </div>

        <section className={styles.loveNext}>
          <div className={styles.loveNextCopy}>
            <div className={styles.loveNextEyebrow}>next best move</div>
            <h2>{nextTitle}</h2>
            <p>{nextBody}</p>
          </div>
          <div className={styles.loveNextPanel}>
            <div className={styles.loveNextTiles}>
              <div className={styles.loveNextTile}><strong>{yourMoveCount}</strong><span>your move</span></div>
              <div className={styles.loveNextTile}><strong>{chattingCount}</strong><span>chatting</span></div>
              <div className={styles.loveNextTile}><strong>{waitingCount}</strong><span>waiting</span></div>
            </div>
            <a href={nextCard ? `/match/${nextCard.matchId}` : '#roster'} className={styles.loveNextButton}>
              {nextCard ? `open ${nextCard.name.split(' ')[0]}` : 'see roster'} →
            </a>
          </div>
        </section>

        {/* dates: change your city + match radius (was on the hub) */}
        <div style={{ marginBottom: '2rem' }}>
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
        <div id="roster">
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
        </div>

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
        </div>{/* /left */}

        {/* RIGHT: your own profile — a quick jump to /profile. */}
        <aside className="dashAside">
          <div style={{ background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 20, padding: '1.4rem 1.3rem', boxShadow: 'var(--shadow-md)', textAlign: 'center' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '1rem', textAlign: 'left' }}>your profile</div>
            <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 0.9rem', background: 'var(--h-surface-2)', border: '2px solid var(--blue)' }}>
              {user.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 32% 28%, rgba(37,99,255,0.2), transparent 60%), var(--h-surface-2)', fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, color: 'var(--blue)', fontSize: '2.2rem' }}>{(user.name?.[0] || '✦').toUpperCase()}</div>
              )}
            </div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontSize: '1.35rem', fontWeight: 700, color: 'var(--h-text)', lineHeight: 1.1 }}>{user.name || 'you'}</div>
            {user.archetype && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginTop: '0.4rem' }}>{user.archetype}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.3rem 0.7rem', marginTop: '0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.04em', color: 'var(--h-text-dim)' }}>
              {dashCity && <span>📍 {dashCity}</span>}
              {user.occupation && <span>💼 {user.occupation}</span>}
              {user.intro_video_url && <span style={{ color: 'var(--h-accent)' }}>🎬 video</span>}
            </div>
            <a href="/profile" style={{ display: 'block', marginTop: '1.2rem', textDecoration: 'none', background: '#0b0b0b', color: '#fff', borderRadius: 999, padding: '0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>view / edit profile →</a>
            <a href="/profile/preview" style={{ display: 'block', marginTop: '0.55rem', textDecoration: 'none', border: '1px solid var(--h-border)', color: 'var(--h-text-dim)', borderRadius: 999, padding: '0.6rem', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>preview as a match →</a>
          </div>
        </aside>
        </div>{/* /dashGrid */}
      </div>
    </div>
  );
}
