import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import MatchReveal from './match-reveal';
import RosterPicker from './roster-picker';
import LocationControls from '@/components/location-controls';
import { zipDistanceMiles, DEFAULT_MATCH_RADIUS, MAX_MATCH_RADIUS, metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { recordUnlock } from '@/lib/record-unlock';
import { isPro } from '@/lib/pro';
import { liveMatchesFor, releaseTimedOutMatches, MAX_CONNECTIONS } from '@/lib/match-actions';
import { profileUnlockSummary } from '@/lib/profile-unlock';
import { recordMonetizationEvent } from '@/lib/monetization';
import LoveUnlockOffer from './love-unlock-offer';
import styles from './dashboard.module.css';
import { sameRealm } from '@/lib/realm';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { unlock_session?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (!user.archetype) redirect('/quiz');

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

  await releaseTimedOutMatches(user.id);
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
  const CARD_COLS =
    'id, name, age, photo_url, archetype, occupation, zip, relationship_style, sun_sign, bio, gallery, music, food, hobbies, ' +
    'sports, prompts, vibes, values_profile, attach_style, ' +
    'score_honesty, score_emotionality, score_extraversion, score_agreeableness, score_conscientiousness, score_openness, is_test';
  const [{ data: unlockRows }, { data: others }, { data: historyOthers }, { data: recentMsgs }] = await Promise.all([
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
      ? supabaseAdmin.from('users').select('id, name, is_test').in('id', historyOtherIds)
      : Promise.resolve({ data: [] as any[] }),
    // Latest messages across the live matches → unread badges ("they replied").
    liveIds.length
      ? supabaseAdmin.from('messages').select('match_id, sender_id, created_at')
          .in('match_id', liveIds).order('created_at', { ascending: false }).limit(120)
      : Promise.resolve({ data: [] as any[] }),
  ] as any[]);

  // Newest incoming message per match (first hit wins — rows are desc).
  const lastFromOtherByMatch = new Map<string, string>();
  (recentMsgs ?? []).forEach((r: any) => {
    if (r.sender_id !== user.id && !lastFromOtherByMatch.has(r.match_id)) {
      lastFromOtherByMatch.set(r.match_id, r.created_at);
    }
  });

  const unlockByMatch = new Map<string, any>((unlockRows ?? []).map((u: any) => [u.match_id, u]));
  const otherById = new Map<string, any>((others ?? []).map((u: any) => [u.id, u]));
  const historyOtherById = new Map<string, any>((historyOthers ?? []).map((historyUser: any) => [historyUser.id, historyUser]));

  const isTestViewer = (user as any).is_test === true;
  const viewerIsPro = isPro(user);
  const connections = liveMatches
    .map((m: any) => {
      const otherId = m.user_1_id === user.id ? m.user_2_id : m.user_1_id;
      const other = otherById.get(otherId);
      if (!other) return null;
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
  const safeHistoryMatches = (historyMatches ?? []).filter((match: any) => {
    const otherId = match.user_1_id === user.id ? match.user_2_id : match.user_1_id;
    return sameRealm(user, historyOtherById.get(otherId));
  });

  const newest = connections[0] || null;
  const newestFresh = !!newest?.match?.created_at &&
    Date.now() - new Date(newest.match.created_at).getTime() < 12 * 60 * 1000;

  const dashMetro = metroOf(user.zip);
  const dashCity = dashMetro && METRO_CENTERS[dashMetro] ? `${METRO_CENTERS[dashMetro].city}, ${METRO_CENTERS[dashMetro].state}` : null;
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
    const unlockSummary = profileUnlockSummary(o);
    const interests = c.profileUnlocked
      ? [...(o.music || []), ...(o.food || []), ...(o.hobbies || [])].filter(Boolean).slice(0, 5)
      : [];
    // Unread: they messaged after my last read stamp. Pre-migration (no read
    // cols on the row) we stay quiet rather than false-badging everything.
    const myReadAt = isU1 ? m.user_1_read_at : m.user_2_read_at;
    const lastIn = lastFromOtherByMatch.get(m.id);
    const unread = !!lastIn && ('user_1_read_at' in m) && (!myReadAt || new Date(lastIn) > new Date(myReadAt));
    return {
      matchId: m.id, name: o.name || 'your match', photo_url: o.photo_url || null,
      age: o.age ?? null, archetype: o.archetype || null, occupation: o.occupation || null,
      city: cityLabel(o.zip), relationship_style: o.relationship_style || null, sun_sign: o.sun_sign || null,
      score: m.compatibility_score ?? null,
      bio: c.profileUnlocked ? (o.bio || null) : null, interests, unread,
      status: (both ? 'chatting' : myAcc ? 'waiting' : 'your-move') as 'chatting' | 'waiting' | 'your-move',
      profileUnlocked: c.profileUnlocked,
      unlockAvailable: unlockSummary.available,
      unlockItems: unlockSummary.items,
    };
  });

  const lockedOffer = activeCards.find((card) => !card.profileUnlocked && card.unlockAvailable) ?? null;
  if (lockedOffer && !isTestViewer) {
    await recordMonetizationEvent({
      userId: user.id,
      event: 'paywall_viewed',
      product: 'love_profile',
      surface: 'love_dashboard',
      matchId: lockedOffer.matchId,
      amountCents: 99,
    });
  }

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
    ? 'A small opener beats a perfect one. Make it specific and easy to answer.'
    : chattingCount > 0
      ? 'Reply, suggest a window, or ask the thing you actually want to know.'
      : 'Love Line gives you room for three active connections and five curated options. Start with the profile that gives you a real reason to say yes.';
  const nextAction = nextCard?.status === 'your-move'
    ? `say hi to ${nextCard.name.split(' ')[0]}`
    : nextCard
      ? `continue with ${nextCard.name.split(' ')[0]}`
      : 'see your five options';
  const loveProfileTags = [
    ...(Array.isArray((user as any).music) ? (user as any).music : []),
    ...(Array.isArray((user as any).food) ? (user as any).food : []),
    ...(Array.isArray((user as any).hobbies) ? (user as any).hobbies : []),
    ...(Array.isArray((user as any).sports) ? (user as any).sports : []),
  ].filter(Boolean).slice(0, 6);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.head}>
          <div className={styles.eyebrow}>the love line</div>
          <h1 className={styles.title}>your matches, your move.</h1>
          <p className={styles.subtitle}>
            {connections.length > 0
              ? `${activeCards.length} ${activeCards.length === 1 ? 'conversation' : 'conversations'} going · up to ${MAX_CONNECTIONS} at once · you set the pace`
              : 'pick who you connect with · you set the pace'}
          </p>
          <details className={styles.lovePolicyDetails}>
            <summary>how Love Line works</summary>
            <div className={styles.lovePolicyBar} aria-label="Love Line matching limits">
              <span><strong>{MAX_CONNECTIONS}</strong> active matches</span>
              <span><strong>5</strong> curated options</span>
              <span><strong>7d</strong> cooldown before repeats</span>
            </div>
          </details>
        </div>

        <div className={styles.loveGrid}>
          <aside className={styles.loveSide}>
            <section className={styles.loveProfileCard}>
              <div className={styles.loveProfileTop}>
                <div className={styles.loveAvatar}>
                  {user.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.photo_url} alt="" />
                  ) : (
                    <span>{(user.name?.[0] || 'N').toUpperCase()}</span>
                  )}
                </div>
                <div className={styles.loveProfileCopy}>
                  <span>your love profile</span>
                  <strong>{user.name || 'you'}</strong>
                  {user.archetype && <em>{user.archetype}</em>}
                </div>
              </div>

              <div className={styles.loveMiniStats}>
                <div><strong>{activeCards.length}</strong><span>live</span></div>
                <div><strong>{yourMoveCount}</strong><span>your move</span></div>
                <div><strong>{MAX_CONNECTIONS}</strong><span>max chats</span></div>
              </div>

              <div className={styles.loveProfileMeta}>
                {dashCity && <span>{dashCity}</span>}
                <span>{user.match_radius ?? DEFAULT_MATCH_RADIUS} mile radius</span>
                {user.occupation && <span>{user.occupation}</span>}
              </div>

              {loveProfileTags.length > 0 && (
                <div className={styles.loveTags}>
                  {loveProfileTags.map((tag: string, i: number) => <span key={`${tag}-${i}`}>{tag}</span>)}
                </div>
              )}

              <div className={styles.loveControls}>
                <LocationControls city={dashCity} currentMetro={dashMetro} radius={user.match_radius ?? DEFAULT_MATCH_RADIUS} showRadius />
              </div>

              <div className={styles.loveLinks}>
                <a href="/profile">edit baseline</a>
                <a href="/profile/preview">preview</a>
                <a href="/quiz?line=love">retake love setup</a>
                <a href="/quiz?retake=1">restart core quiz</a>
              </div>
            </section>

            <section className={styles.loveChatPanel}>
              <div className={styles.panelKicker}>your conversations</div>
              {activeCards.length > 0 ? (
                <div className={styles.loveChatList}>
                  {activeCards.map((card) => (
                    <a key={card.matchId} href={`/match/${card.matchId}`} className={styles.loveChatRow}>
                      <span className={styles.chatAvatar}>
                        {card.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={card.photo_url} alt="" />
                        ) : (
                          <b>{card.name.charAt(0)}</b>
                        )}
                      </span>
                      <span className={styles.chatCopy}>
                        <strong>{card.name.split(' ')[0]}{card.age ? `, ${card.age}` : ''}</strong>
                        <em>
                          {card.status === 'chatting' ? 'chat open' : card.status === 'your-move' ? 'your move' : 'waiting on them'}
                          {!card.profileUnlocked && card.unlockAvailable ? ' · compatibility details locked' : ''}
                        </em>
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className={styles.loveEmpty}>No live conversations yet. Your next one starts in the roster.</p>
              )}
            </section>

            {safeHistoryMatches.length > 0 && (
              <section className={styles.loveHistoryPanel}>
                <div>
                  <div className={styles.panelKicker}>past conversations</div>
                  <p>Revisit who you met, then come back to what is live now.</p>
                </div>
                <details className={styles.historyDetails}>
                  <summary>look at past conversations</summary>
                  <div className={styles.historyMiniList}>
                    {safeHistoryMatches.map((m: any) => {
                      const otherId = m.user_1_id === user.id ? m.user_2_id : m.user_1_id;
                      const name = historyOtherById.get(otherId)?.name || 'a match';
                      return (
                        <a key={m.id} href={`/match/${m.id}`}>
                          <span>{name}</span>
                          <em>{new Date(m.ended_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</em>
                        </a>
                      );
                    })}
                  </div>
                </details>
              </section>
            )}
          </aside>

          <main className={styles.loveMain}>
            <section className={styles.loveNext}>
              <div className={styles.loveNextCopy}>
                <div className={styles.loveNextSignal}>
                  <div className={styles.loveNextEyebrow}>next best move</div>
                </div>
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
                  {nextAction} →
                </a>
              </div>
            </section>

            {newest && newestFresh && (
              <MatchReveal
                matchId={newest.match.id}
                name={newest.otherUser.name || 'your match'}
                score={newest.match.compatibility_score ?? null}
                archetype={newest.otherUser.archetype}
              />
            )}

            <div id="roster" className={styles.rosterAnchor}>
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

            {lockedOffer && (
              <LoveUnlockOffer
                matchId={lockedOffer.matchId}
                name={lockedOffer.name}
                items={lockedOffer.unlockItems}
              />
            )}

          </main>
        </div>
      </div>
    </div>
  );
}
