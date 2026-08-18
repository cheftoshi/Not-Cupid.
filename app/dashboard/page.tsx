import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import RosterPicker from './roster-picker';
import LoveConnections from './love-connections';
import LocationControls from '@/components/location-controls';
import { DEFAULT_MATCH_RADIUS, MAX_MATCH_RADIUS, metroOf, METRO_CENTERS } from '@/lib/quiz-data';
import { liveMatchesFor, releaseTimedOutMatches, MAX_CONNECTIONS } from '@/lib/match-actions';
import styles from './dashboard.module.css';
import { sameRealm } from '@/lib/realm';
import { profileReadiness } from '@/lib/profile-readiness';
import { LOVE_INCLUDED_PICKS, LOVE_ROSTER_OPTIONS } from '@/lib/matching-policy';
import { markLoveNotificationOpened } from '@/lib/love-notification-ledger';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    extra_connection?: string;
    candidate?: string;
    focus?: string;
    love_event?: string;
  }>;
}) {
  const {
    extra_connection: extraConnection,
    candidate: paidCandidateId,
    focus: focusMatchId,
    love_event: loveEventId,
  } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');
  if (!user.archetype) redirect('/quiz');

  if (loveEventId) await markLoveNotificationOpened(loveEventId, user.id);

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
  const CARD_COLS = 'id, name, age, photo_url, archetype, is_test';
  const [{ data: others }, { data: historyOthers }, { data: recentMsgs }] = await Promise.all([
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

  const otherById = new Map<string, any>((others ?? []).map((u: any) => [u.id, u]));
  const historyOtherById = new Map<string, any>((historyOthers ?? []).map((historyUser: any) => [historyUser.id, historyUser]));

  const isTestViewer = (user as any).is_test === true;
  const connections = liveMatches
    .map((m: any) => {
      const otherId = m.user_1_id === user.id ? m.user_2_id : m.user_1_id;
      const other = otherById.get(otherId);
      if (!other) return null;
      if (((other as any).is_test === true) !== isTestViewer) return null;
      return {
        match: m,
        otherUser: other,
      };
    })
    .filter(Boolean) as any[];
  const safeHistoryMatches = (historyMatches ?? []).filter((match: any) => {
    const otherId = match.user_1_id === user.id ? match.user_2_id : match.user_1_id;
    return sameRealm(user, historyOtherById.get(otherId));
  });

  const dashMetro = metroOf(user.zip);
  const dashCity = dashMetro && METRO_CENTERS[dashMetro] ? `${METRO_CENTERS[dashMetro].city}, ${METRO_CENTERS[dashMetro].state}` : null;

  const activeCards = connections.map((c: any) => {
    const m = c.match;
    const isU1 = m.user_1_id === user.id;
    const myAcc = isU1 ? m.user_1_accepted : m.user_2_accepted;
    const both = m.user_1_accepted && m.user_2_accepted;
    const o = c.otherUser;
    // Unread: they messaged after my last read stamp. Pre-migration (no read
    // cols on the row) we stay quiet rather than false-badging everything.
    const myReadAt = isU1 ? m.user_1_read_at : m.user_2_read_at;
    const lastIn = lastFromOtherByMatch.get(m.id);
    const unread = !!lastIn && ('user_1_read_at' in m) && (!myReadAt || new Date(lastIn) > new Date(myReadAt));
    return {
      matchId: m.id, name: o.name || 'your match', photo_url: o.photo_url || null,
      age: o.age ?? null, archetype: o.archetype || null,
      score: m.compatibility_score ?? null,
      unread,
      status: (both ? 'chatting' : myAcc ? 'waiting' : 'your-move') as 'chatting' | 'waiting' | 'your-move',
    };
  });

  const yourMoveCount = activeCards.filter((card) => card.status === 'your-move').length;
  const loveProfileTags = [
    ...(Array.isArray((user as any).music) ? (user as any).music : []),
    ...(Array.isArray((user as any).food) ? (user as any).food : []),
    ...(Array.isArray((user as any).hobbies) ? (user as any).hobbies : []),
    ...(Array.isArray((user as any).sports) ? (user as any).sports : []),
  ].filter(Boolean).slice(0, 6);
  const readiness = profileReadiness(user);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.head}>
          <div className={styles.eyebrow}>the love line</div>
          <h1 className={styles.title}>your matches, your move.</h1>
          <p className={styles.subtitle}>
            {connections.length > 0
              ? `${activeCards.length} ${activeCards.length === 1 ? 'connection' : 'connections'} going · ${LOVE_INCLUDED_PICKS} picks included in each roster · you set the pace`
              : 'pick who you connect with · you set the pace'}
          </p>
          <details className={styles.lovePolicyDetails}>
            <summary>how Love Line works</summary>
            <div className={styles.lovePolicyBar} aria-label="Love Line matching limits">
              <span><strong>{LOVE_INCLUDED_PICKS}</strong> included picks</span>
              <span><strong>{LOVE_ROSTER_OPTIONS}</strong> curated options</span>
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
                <div><strong>{LOVE_INCLUDED_PICKS}</strong><span>included picks</span></div>
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

            {!readiness.complete && (
              <section className={styles.loveCompletionCard}>
                <div className={styles.panelKicker}>{readiness.coreReady ? 'your profile is live' : 'matching setup'}</div>
                <h2>Complete your profile</h2>
                <p>Better context gives each person a clearer reason to choose you.</p>
                <div>
                  {readiness.missing.map((item) => <span key={item.key}>+ {item.label}</span>)}
                </div>
                <a href="/profile?mode=edit&from=love-completion">finish these details →</a>
              </section>
            )}

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
            <LoveConnections
              includedPicks={LOVE_INCLUDED_PICKS}
              focusMatchId={focusMatchId}
              connections={activeCards.map((card) => ({
                matchId: card.matchId,
                name: card.name,
                age: card.age,
                photo_url: card.photo_url,
                archetype: card.archetype,
                score: card.score,
                unread: card.unread,
                status: card.status,
              }))}
            />

            <div id="roster" className={styles.rosterAnchor}>
              <RosterPicker
                radius={user.match_radius ?? DEFAULT_MATCH_RADIUS}
                maxRadius={MAX_MATCH_RADIUS}
                maxConnections={MAX_CONNECTIONS}
                includedPicks={LOVE_INCLUDED_PICKS}
                horizontal
                hasActive={activeCards.length > 0}
                paidCandidateId={extraConnection === 'ready' ? paidCandidateId : undefined}
                checkoutError={extraConnection === 'error'}
                liveConnections={connections.map((c: any) => ({
                  matchId: c.match.id,
                  name: c.otherUser.name || 'your match',
                }))}
              />
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
